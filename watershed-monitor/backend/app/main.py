from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import asyncio
import math
import re
import uuid
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from PIL import ExifTags, Image, UnidentifiedImageError
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from .security import create_session_token, hash_password, read_session_token, verify_password


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False)

    database_url: str | None = None
    db_host: str = "localhost"
    db_port: int = 5433
    db_name: str = "watershed"
    db_user: str = "watershed_app"
    db_password: str = "local-only"
    upload_dir: Path = Path("uploads")
    max_upload_mb: int = Field(default=20, ge=1, le=100)
    cors_origins: str = "http://localhost:5173"
    admin_email: str
    admin_password: str
    session_secret: str
    session_cookie_secure: bool = False
    session_ttl_minutes: int = Field(default=480, ge=15, le=1440)
    session_cookie_name: str = "watershed_session"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def connection_string(self) -> str:
        if self.database_url:
            return self.database_url
        return make_conninfo(
            host=self.db_host,
            port=self.db_port,
            dbname=self.db_name,
            user=self.db_user,
            password=self.db_password,
        )


settings = Settings()
pool = ConnectionPool(
    conninfo=settings.connection_string,
    min_size=1,
    max_size=8,
    kwargs={"row_factory": dict_row},
    open=False,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if len(settings.admin_password) < 16:
        raise RuntimeError("ADMIN_PASSWORD must contain at least 16 characters")
    if len(settings.session_secret) < 32:
        raise RuntimeError("SESSION_SECRET must contain at least 32 characters")
    if "@" not in settings.admin_email:
        raise RuntimeError("ADMIN_EMAIL must be a valid email address")
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    pool.open(wait=True)
    with pool.connection() as conn:
        conn.execute(
            """
            INSERT INTO app_users (email, display_name, password_hash, role)
            VALUES (%s, 'Local administrator', %s, 'admin')
            ON CONFLICT (email) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                password_hash = EXCLUDED.password_hash,
                role = 'admin',
                is_active = true,
                updated_at = now()
            """,
            (settings.admin_email.strip().lower(), hash_password(settings.admin_password)),
        )
    yield
    pool.close()


app = FastAPI(
    title="Watershed Monitoring API",
    description="Local development API for watershed boundaries and reviewed field evidence.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)

_login_attempts: dict[str, list[float]] = {}
_registration_attempts: dict[str, list[float]] = {}


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class RegistrationRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=256)


def _check_login_rate_limit(key: str) -> None:
    now = time.monotonic()
    recent = [timestamp for timestamp in _login_attempts.get(key, []) if now - timestamp < 900]
    if len(recent) >= 8:
        _login_attempts[key] = recent
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again in 15 minutes.")
    recent.append(now)
    _login_attempts[key] = recent


def _check_registration_rate_limit(key: str) -> None:
    now = time.monotonic()
    recent = [timestamp for timestamp in _registration_attempts.get(key, []) if now - timestamp < 3600]
    if len(recent) >= 5:
        _registration_attempts[key] = recent
        raise HTTPException(status_code=429, detail="Too many registration attempts. Try again later.")
    recent.append(now)
    _registration_attempts[key] = recent


def _issue_session(user: dict, response: Response) -> dict:
    expires_at = int(time.time()) + settings.session_ttl_minutes * 60
    token = create_session_token(
        {"sub": str(user["id"]), "exp": expires_at, "iat": int(time.time())}, settings.session_secret
    )
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_minutes * 60,
        path="/",
    )
    return {"id": str(user["id"]), "email": user["email"], "display_name": user["display_name"], "role": user["role"]}


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(settings.session_cookie_name)
    claims = read_session_token(token, settings.session_secret) if token else None
    if not claims or not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Sign in to access this workspace")
    try:
        with pool.connection() as conn:
            user = conn.execute(
                "SELECT id, email, display_name, role, is_active FROM app_users WHERE id = %s",
                (claims["sub"],),
            ).fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not verify the current session") from exc
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="This account is disabled or no longer exists")
    return {key: (str(value) if key == "id" else value) for key, value in user.items()}


def require_roles(*roles: str):
    def check_role(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Your account does not have permission for this action")
        return user
    return check_role


@app.post("/api/auth/login")
def login(credentials: LoginRequest, request: Request, response: Response):
    email = credentials.email.strip().lower()
    remote = request.client.host if request.client else "unknown"
    rate_key = f"{remote}:{email}"
    _check_login_rate_limit(rate_key)
    try:
        with pool.connection() as conn:
            user = conn.execute(
                "SELECT id, email, display_name, password_hash, role, is_active FROM app_users WHERE email = %s",
                (email,),
            ).fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Sign-in service is not ready") from exc
    if not user or not user["is_active"] or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    _login_attempts.pop(rate_key, None)
    return _issue_session(user, response)


@app.post("/api/auth/register", status_code=201)
def register(registration: RegistrationRequest, request: Request, response: Response):
    remote = request.client.host if request.client else "unknown"
    _check_registration_rate_limit(remote)
    email = registration.email.strip().lower()
    display_name = registration.display_name.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if len(display_name) < 2:
        raise HTTPException(status_code=422, detail="Name must contain at least two characters")
    try:
        with pool.connection() as conn:
            user = conn.execute(
                """
                INSERT INTO app_users (email, display_name, password_hash, role)
                VALUES (%s, %s, %s, 'field_staff')
                ON CONFLICT (email) DO NOTHING
                RETURNING id, email, display_name, role
                """,
                (email, display_name, hash_password(registration.password)),
            ).fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Registration service is not ready") from exc
    if not user:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return _issue_session(user, response)


@app.get("/api/auth/me")
def session_user(user: dict = Depends(get_current_user)):
    return user


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(key=settings.session_cookie_name, httponly=True, secure=settings.session_cookie_secure, samesite="lax", path="/")
    return {"status": "signed_out"}


def connection():
    with pool.connection() as conn:
        yield conn


@app.get("/api/health")
def health():
    try:
        with pool.connection() as conn:
            row = conn.execute("SELECT PostGIS_Full_Version() AS postgis").fetchone()
        return {"status": "ok", "database": "connected", "spatial_extension": row["postgis"]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not ready") from exc


@app.get("/api/watersheds")
def list_watersheds(_: dict = Depends(get_current_user)):
    try:
        with pool.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, name, admin_area, source, data_origin, properties,
                       ST_AsGeoJSON(geom)::json AS geometry,
                       ROUND((ST_Area(geom::geography) / 1000000.0)::numeric, 2) AS area_sq_km
                FROM watersheds ORDER BY name
                """
            ).fetchall()
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": str(row["id"]),
                    "geometry": row["geometry"],
                    "properties": {
                        "name": row["name"],
                        "admin_area": row["admin_area"],
                        "source": row["source"],
                        "data_origin": row["data_origin"],
                        "area_sq_km": float(row["area_sq_km"]),
                        **row["properties"],
                    },
                }
                for row in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not read watershed data") from exc


class WatershedCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    admin_area: str = Field(default="", max_length=240)
    source: str = Field(min_length=2, max_length=240)
    geometry: dict[str, Any]


def _validate_boundary_coordinates(geometry: dict[str, Any]) -> None:
    geometry_type = geometry.get("type")
    if geometry_type not in {"Polygon", "MultiPolygon"}:
        raise HTTPException(status_code=422, detail="Import one GeoJSON Polygon or MultiPolygon boundary")
    coordinates = geometry.get("coordinates")
    polygons = [coordinates] if geometry_type == "Polygon" else coordinates
    if not isinstance(polygons, list) or not polygons:
        raise HTTPException(status_code=422, detail="Boundary GeoJSON has no polygon coordinates")
    for polygon in polygons:
        if not isinstance(polygon, list) or not polygon:
            raise HTTPException(status_code=422, detail="Each polygon must contain at least one closed ring")
        for ring in polygon:
            if not isinstance(ring, list) or len(ring) < 4:
                raise HTTPException(status_code=422, detail="Each polygon ring must contain at least four coordinates")
            positions: list[list[float]] = []
            for position in ring:
                if not isinstance(position, list) or len(position) < 2:
                    raise HTTPException(status_code=422, detail="Boundary coordinates must be longitude/latitude pairs")
                if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in position):
                    raise HTTPException(status_code=422, detail="Boundary coordinates must be finite numbers")
                longitude, latitude = position[0], position[1]
                if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
                    raise HTTPException(status_code=422, detail="GeoJSON coordinates must use longitude and latitude in EPSG:4326")
                positions.append([longitude, latitude])
            if positions[0] != positions[-1]:
                raise HTTPException(status_code=422, detail="Polygon rings must be closed")


@app.post("/api/watersheds", status_code=201)
def create_watershed(watershed: WatershedCreate, _: dict = Depends(require_roles("admin"))):
    name = watershed.name.strip()
    source = watershed.source.strip()
    if not name or not source:
        raise HTTPException(status_code=422, detail="Area name and boundary source are required")
    _validate_boundary_coordinates(watershed.geometry)
    encoded_geometry = json.dumps(watershed.geometry, separators=(",", ":"))
    if len(encoded_geometry.encode("utf-8")) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Boundary GeoJSON exceeds 10 MB")

    try:
        with pool.connection() as conn:
            candidate = conn.execute(
                """
                WITH candidate AS (
                    SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)) AS geom
                )
                SELECT GeometryType(geom) AS geometry_type,
                       ST_IsEmpty(geom) AS is_empty,
                       ST_IsValid(geom) AS is_valid,
                       ST_IsValidReason(geom) AS validity_reason,
                       ST_XMin(Box3D(geom)) AS min_x, ST_XMax(Box3D(geom)) AS max_x,
                       ST_YMin(Box3D(geom)) AS min_y, ST_YMax(Box3D(geom)) AS max_y,
                       ST_Area(geom::geography) AS area_sq_m,
                       EXISTS (SELECT 1 FROM watersheds w WHERE ST_Equals(w.geom, candidate.geom)) AS duplicate
                FROM candidate
                """,
                (encoded_geometry,),
            ).fetchone()
            if candidate["geometry_type"] != "MULTIPOLYGON" or candidate["is_empty"]:
                raise HTTPException(status_code=422, detail="Boundary must contain a non-empty polygon")
            if not candidate["is_valid"]:
                raise HTTPException(status_code=422, detail=f"Invalid boundary: {candidate['validity_reason']}")
            if not (-180 <= candidate["min_x"] <= candidate["max_x"] <= 180
                    and -90 <= candidate["min_y"] <= candidate["max_y"] <= 90):
                raise HTTPException(status_code=422, detail="GeoJSON coordinates must use longitude and latitude in EPSG:4326")
            if candidate["area_sq_m"] <= 0:
                raise HTTPException(status_code=422, detail="Boundary area must be greater than zero")
            if candidate["duplicate"]:
                raise HTTPException(status_code=409, detail="This boundary already exists in the workspace")

            row = conn.execute(
                """
                INSERT INTO watersheds (name, admin_area, source, data_origin, geom, properties)
                VALUES (
                    %s, NULLIF(%s, ''), %s, 'external',
                    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)),
                    jsonb_build_object('official_boundary', false, 'pilot_confirmed', false)
                )
                RETURNING id, name
                """,
                (name, watershed.admin_area.strip(), source, encoded_geometry),
            ).fetchone()
        return {"id": str(row["id"]), "name": row["name"], "pilot_confirmed": False}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not save the boundary; check the database connection") from exc


@app.get("/api/interventions")
def list_interventions(_: dict = Depends(get_current_user)):
    try:
        with pool.connection() as conn:
            rows = conn.execute(
                """
                SELECT i.id, i.watershed_id, i.name, i.intervention_type, i.status, i.source, i.data_origin,
                       i.properties, ST_AsGeoJSON(i.geom)::json AS geometry
                FROM interventions i ORDER BY i.name
                """
            ).fetchall()
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": str(row["id"]),
                    "geometry": row["geometry"],
                    "properties": {
                        **row["properties"],
                        "watershed_id": str(row["watershed_id"]),
                        "name": row["name"],
                        "intervention_type": row["intervention_type"],
                        "status": row["status"],
                        "source": row["source"],
                        "data_origin": row["data_origin"],
                    },
                }
                for row in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not read intervention data") from exc


@app.get("/api/observations")
def list_observations(_: dict = Depends(get_current_user)):
    try:
        with pool.connection() as conn:
            rows = conn.execute(
                """
                SELECT o.id, o.watershed_id, o.intervention_id, o.category, o.description,
                       o.captured_at, o.image_key, o.image_sha256, o.media_type,
                       o.quality_flags, o.review_status, o.data_origin, o.metadata,
                       ST_X(o.geom) AS longitude, ST_Y(o.geom) AS latitude,
                       i.name AS intervention_name
                FROM observations o
                LEFT JOIN interventions i ON i.id = o.intervention_id
                ORDER BY o.created_at DESC
                """
            ).fetchall()
        return [
            {
                **{key: (str(value) if key in {"id", "watershed_id", "intervention_id"} and value else value)
                   for key, value in row.items()},
                "captured_at": row["captured_at"].isoformat() if row["captured_at"] else None,
                "has_image": bool(row["image_key"]),
                "image_url": f"/api/observations/{row['id']}/image" if row["image_key"] else None,
            }
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not read observation data") from exc


@app.get("/api/summary")
def summary(_: dict = Depends(get_current_user)):
    try:
        with pool.connection() as conn:
            row = conn.execute(
                """
                SELECT
                  (SELECT count(*) FROM watersheds) AS watershed_count,
                  (SELECT count(*) FROM interventions) AS intervention_count,
                  (SELECT count(*) FROM observations) AS observation_count,
                  (SELECT count(*) FROM observations WHERE image_key IS NOT NULL) AS photo_count,
                  (SELECT count(*) FROM observations WHERE review_status = 'pending') AS pending_count,
                  (SELECT count(*) FROM observations WHERE data_origin = 'illustrative') AS illustrative_count
                """
            ).fetchone()
        return {key: int(value) for key, value in row.items()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not read summary data") from exc


def _as_float(value):
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        return float(value.numerator) / float(value.denominator)
    return float(value)


def _coordinate_from_exif(gps: dict, value_key: str, ref_key: str):
    values = gps.get(value_key)
    ref = gps.get(ref_key)
    if not values or not ref:
        return None
    degrees, minutes, seconds = (_as_float(part) for part in values)
    coordinate = degrees + minutes / 60 + seconds / 3600
    if str(ref).upper() in {"S", "W"}:
        coordinate *= -1
    return coordinate


def _read_image_metadata(contents: bytes) -> tuple[dict, float | None, float | None, str | None]:
    try:
        image = Image.open(io.BytesIO(contents))
        exif = image.getexif()
        image.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=415, detail="The uploaded file is not a readable image") from exc

    tags = {ExifTags.TAGS.get(key, str(key)): value for key, value in exif.items()}
    raw_gps = exif.get_ifd(34853) if exif else {}
    gps = {ExifTags.GPSTAGS.get(key, str(key)): value for key, value in raw_gps.items()}
    latitude = _coordinate_from_exif(gps, "GPSLatitude", "GPSLatitudeRef")
    longitude = _coordinate_from_exif(gps, "GPSLongitude", "GPSLongitudeRef")
    metadata = {
        "exif_date_original": str(tags.get("DateTimeOriginal")) if tags.get("DateTimeOriginal") else None,
        "camera_make": str(tags.get("Make")) if tags.get("Make") else None,
        "camera_model": str(tags.get("Model")) if tags.get("Model") else None,
        "gps_present": latitude is not None and longitude is not None,
    }
    return metadata, latitude, longitude, image.format


class ReviewUpdate(BaseModel):
    status: Literal["pending", "in_review", "approved", "needs_changes"]
    comment: str = Field(default="", max_length=2000)


@app.post("/api/observations", status_code=201)
async def upload_observation(
    file: UploadFile = File(...),
    category: str = Form(..., min_length=2, max_length=80),
    description: str = Form(default="", max_length=2000),
    watershed_id: uuid.UUID | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    _: dict = Depends(require_roles("admin", "field_staff")),
):
    content_type = (file.content_type or "").lower()
    allowed = {"image/jpeg": ".jpg", "image/png": ".png"}
    if content_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a JPEG or PNG image")
    contents = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(contents) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image exceeds {settings.max_upload_mb} MB")
    metadata, exif_lat, exif_lon, image_format = _read_image_metadata(contents)
    expected_format = {"image/jpeg": "JPEG", "image/png": "PNG"}[content_type]
    if image_format != expected_format:
        raise HTTPException(status_code=415, detail="The file contents do not match the selected image type")
    if (latitude is None) != (longitude is None):
        raise HTTPException(status_code=422, detail="Provide both latitude and longitude, or neither")
    latitude = latitude if latitude is not None else exif_lat
    longitude = longitude if longitude is not None else exif_lon
    if latitude is not None and longitude is not None:
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise HTTPException(status_code=422, detail="Coordinates are outside valid longitude/latitude ranges")
    flags = []
    if latitude is None or longitude is None:
        flags.append("missing_gps")
    if not metadata["exif_date_original"]:
        flags.append("missing_capture_time")

    observation_id = uuid.uuid4()
    relative_key = f"{observation_id}{allowed[content_type]}"
    image_path = settings.upload_dir / relative_key
    image_path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(image_path.write_bytes, contents)
    checksum = hashlib.sha256(contents).hexdigest()
    try:
        with pool.connection() as conn:
            duplicate = conn.execute(
                "SELECT EXISTS(SELECT 1 FROM observations WHERE image_sha256 = %s) AS found",
                (checksum,),
            ).fetchone()["found"]
            if duplicate:
                flags.append("possible_duplicate")
            row = conn.execute(
                """
                INSERT INTO observations
                    (id, watershed_id, category, description, geom, image_key, image_sha256,
                     media_type, image_size_bytes, metadata, quality_flags, data_origin)
                VALUES (
                    %s,
                    COALESCE(%s, (SELECT id FROM watersheds w
                        WHERE %s IS NOT NULL AND ST_Contains(w.geom, ST_SetSRID(ST_MakePoint(%s,%s),4326))
                        ORDER BY w.name LIMIT 1)),
                    %s, %s,
                    CASE WHEN %s IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(%s,%s),4326) END,
                    %s, %s, %s, %s, %s, %s, 'field'
                )
                RETURNING id
                """,
                (observation_id, watershed_id, longitude, longitude, latitude,
                 category.strip(), description.strip(), longitude, longitude, latitude,
                 relative_key, checksum, content_type, len(contents), json.dumps(metadata), flags),
            ).fetchone()
        return {"id": str(row["id"]), "quality_flags": flags, "has_image": True}
    except Exception as exc:
        image_path.unlink(missing_ok=True)
        raise HTTPException(status_code=503, detail="Could not save observation to the database") from exc


@app.get("/api/observations/{observation_id}/image")
def get_observation_image(observation_id: uuid.UUID, _: dict = Depends(get_current_user)):
    with pool.connection() as conn:
        row = conn.execute("SELECT image_key, media_type FROM observations WHERE id = %s", (observation_id,)).fetchone()
    if not row or not row["image_key"]:
        raise HTTPException(status_code=404, detail="Image not found")
    path = (settings.upload_dir / row["image_key"]).resolve()
    if settings.upload_dir.resolve() not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type=row["media_type"] or mimetypes.guess_type(path.name)[0])


@app.get("/api/observations/{observation_id}/review-history")
def get_review_history(observation_id: uuid.UUID, _: dict = Depends(require_roles("admin", "reviewer"))):
    try:
        with pool.connection() as conn:
            if not conn.execute("SELECT 1 FROM observations WHERE id = %s", (observation_id,)).fetchone():
                raise HTTPException(status_code=404, detail="Observation not found")
            rows = conn.execute(
                """SELECT id, actor, previous_status, new_status, comment, created_at
                   FROM review_events WHERE observation_id = %s ORDER BY created_at DESC""",
                (observation_id,),
            ).fetchall()
        return [
            {**row, "id": str(row["id"]), "created_at": row["created_at"].isoformat()}
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not read review history") from exc


@app.patch("/api/observations/{observation_id}/review")
def update_review(observation_id: uuid.UUID, update: ReviewUpdate, user: dict = Depends(require_roles("admin", "reviewer"))):
    try:
        with pool.connection() as conn:
            previous = conn.execute(
                "SELECT review_status FROM observations WHERE id = %s FOR UPDATE",
                (observation_id,),
            ).fetchone()
            if not previous:
                raise HTTPException(status_code=404, detail="Observation not found")
            row = conn.execute(
                "UPDATE observations SET review_status = %s WHERE id = %s RETURNING review_status",
                (update.status, observation_id),
            ).fetchone()
            conn.execute(
                """INSERT INTO review_events (observation_id, actor, previous_status, new_status, comment)
                   VALUES (%s, %s, %s, %s, %s)""",
                (observation_id, user["email"], previous["review_status"], update.status, update.comment.strip()),
            )
        return {"id": str(observation_id), "review_status": row["review_status"]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not update review status") from exc
