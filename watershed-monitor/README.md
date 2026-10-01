# Watershed Geospatial Monitoring and Evidence System

The project is a local development foundation for Problem Statement 26015. It links watershed boundaries, intervention records, geotagged observations, review decisions, and satellite-analysis provenance. The included map records are illustrative only; they are not official watershed boundaries, field observations, or satellite measurements.

## Start locally

1. Copy `.env.example` to `.env` and set a strong local `POSTGRES_PASSWORD`.
2. From this directory, run `docker compose up --build`.
3. Open the web app at `http://localhost:5173` and the API documentation at `http://localhost:8000/docs`.

The local app creates an administrator account from `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` in `.env`. Keep that file private; it is ignored by Git. Set `APP_SESSION_SECRET` to a random value with at least 32 characters. For HTTPS deployment, set `SESSION_COOKIE_SECURE=true` and use HTTPS for both the web app and API.

The public landing page is available at `/`; login and registration are at `/login` and `/register`. Registration creates a `field_staff` account and signs it in. The public page does not expose watershed records; operational modules require sign-in. Before presenting or publishing, replace the sample project email and add the official organization, office address, and optional phone in `.env`. See [PROJECT_CONTENT_GUIDE.md](PROJECT_CONTENT_GUIDE.md) for the exact fields and all sample data that still needs replacement.

The first database startup runs the SQL files in `backend/sql`. Docker exposes the database, API, and web app only on the local machine. If you change the initial SQL after the volume has been created, use a migration for the existing database; initialization scripts only run for a new data volume.

## Current development slice

- Interactive watershed map with explicitly labeled illustrative data.
- FastAPI endpoints for watershed and observation data, image intake, review updates, and health status.
- Local administrator sign-in with salted password hashes, HTTP-only signed sessions, and role-gated upload, review, and boundary-import actions.
- Separate Overview, Spatial Workspace, Field Evidence, Interventions, Satellite Analysis, and Reports & Validation modules.
- Public landing page with sign-in and self-registration; new accounts receive only the field-staff role.
- Live, view-only Bhuvan WMS overlay: NRSC/ISRO LULC 2015–16 (`LULC250K_1516`, 1:250,000 scale), with source/year attribution in the map and analysis module.
- GeoJSON boundary import with PostGIS geometry validation; imported boundaries remain unverified candidates until agency selection is recorded.
- PostGIS schema for watershed boundaries, interventions, photo locations, satellite scene metadata, and review history.
- Local image storage with file checksums and basic EXIF location/date extraction.

If a PostGIS volume already exists, its initialization scripts will not rerun automatically. Apply the new authentication migration to that database before starting the API:

```sh
docker compose exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/002_auth.sql'
```

## Pilot selection and validation

The user selected **Indore district, Madhya Pradesh** as the pilot search area. This does not confirm an exact watershed or an agency-approved pilot site. The representative micro-watershed and authoritative boundary still need to be agreed with the concerned agency after checking that required records are available. While only synthetic fixtures are loaded, the map centers on an approximate Indore city reference point for navigation; that point is not a watershed boundary, observation, or field control point. Do not treat the synthetic map fixture as a candidate site or official data.

Potential source checks for the Indore search area:

- The [NWIC hydrological-boundaries catalog on India's Open Government Data Platform](https://www.data.gov.in/catalog/hydrological-boundaries) describes basin, sub-basin, and watershed shapefiles. The catalog is attributed to the Ministry of Jal Shakti / National Water Informatics Centre and shows a 2022 publication/update date. Verify the actual file, CRS, version, coverage, and boundary authority before importing any feature.
- The [NRSC/ISRO Bhuvan PMKSY viewer](https://bhuvan-app1.nrsc.gov.in/pmksy/index.php) exposes hydrological-boundary and watershed layers in its interface. Verify whether the relevant Indore records can be used and exported under the current service terms.
- The [NRSC/ISRO Bhuvan IWMP-SRISHTI page](https://bhuvan-app1.nrsc.gov.in/iwmp/index_pop.php) describes watershed-level monitoring and access for listed programme areas. Its public description does not establish that the selected Indore watershed or its field photos/scenes are available to this project; agency authorization and data-rights checks remain necessary.
- The currently wired Bhuvan WMS is real NRSC/ISRO LULC context from 2015–16 at 1:250,000 scale; it is not a current scene or local evidence layer. [Copernicus Sentinel-2](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2) is a separate ESA/Copernicus source with free-to-use data products; it may be evaluated as supplementary analysis input, but it is not SRISHTI-DRISHTI or ISRO data.

Before confirming a site, check for:

- An authoritative watershed boundary with source, date, and coordinate reference information.
- Geocoded field images with capture dates and permission to use them for this project.
- Corresponding SRISHTI-DRISHTI scenes, acquisition dates, spatial resolution, processing metadata, and the permitted integration or export route.
- Intervention records that can be linked spatially and temporally to the study area.
- A field-validation contact and reference observations for checking thematic interpretations.

The pilot sequence is: agree the site and data rights; ingest and check sources; produce dated thematic layers and satellite indicators with their methods and limitations; compare those outputs to field evidence; record agency/field validation; then decide whether the method is ready to scale. Small structures must not be claimed as verified from 30 m pixels alone.

Candidate boundaries can be imported from a single-feature GeoJSON `Polygon` or `MultiPolygon` in WGS 84 longitude/latitude (EPSG:4326), up to 10 MB. The API rejects invalid, out-of-range, empty, or duplicate geometry. An imported boundary is not automatically treated as an official boundary or the selected pilot.

The application should retain source, acquisition date, resolution, processing method/version, and review status with each analytical output. Pilot evaluation should record geolocation completeness, boundary/source validity, usable scene coverage, field-validation agreement, and known limitations before any scale-up decision.

## ISRO / NRSC map layer

The map can display the Bhuvan LULC 2015–16 thematic layer through NRSC's WMS endpoint `https://bhuvan-ras2.nrsc.gov.in/cgi-bin/LULC250K.exe` (`LULC250K_1516`). It is served as a live visualization; this application does not download, cache, repackage, or export the Bhuvan layer. The 1:250,000 product is regional context, not recent imagery or a means to verify individual small structures. Follow the current Bhuvan/NRSC service policy and attribution requirements before deployment. The official Bhuvan catalog lists LULC 1:250,000 products for crop years through 2022–23; availability of a particular year/layer must be confirmed with the provider.

Direct SRISHTI-DRISHTI scenes and time-series indicator calculations are not connected yet. They require the selected pilot boundary, permitted access method, suitable scenes, and processing metadata from the concerned agency.

## Before any real field deployment

This is an early development build, not a production service. The local administrator login and role checks support development, but account verification/recovery, organization-level authorization, audit operations, retention policy, operational backups, and a production tile/data service must be completed before real or sensitive field data is uploaded. Self-registration is currently enabled and grants the limited field-staff role; disable or gate it before any public deployment with sensitive records. Do not expose the development ports to a public network. Confirm Bhuvan terms, access rights, and the permitted integration method for SRISHTI-DRISHTI before connecting it. Real image interpretation requires representative source images and field-validated reference observations.

## Data and resolution notes

Demo features are synthetic and tagged as illustrative. A nominal 30 m satellite pixel covers about 900 m² and may be unsuitable for verifying small individual structures. The application is designed to show data source, date, resolution, processing method, and review status with analytical outputs.
