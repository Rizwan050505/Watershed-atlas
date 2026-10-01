from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time


PASSWORD_ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), _unb64(salt_text), int(iterations)
        )
        return hmac.compare_digest(actual, _unb64(digest_text))
    except (ValueError, TypeError):
        return False


def create_session_token(claims: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _b64(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_claims = _b64(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_claims}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_claims}.{_b64(signature)}"


def read_session_token(token: str, secret: str) -> dict | None:
    try:
        encoded_header, encoded_claims, encoded_signature = token.split(".", 2)
        signing_input = f"{encoded_header}.{encoded_claims}".encode("ascii")
        expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(encoded_signature)):
            return None
        header = json.loads(_unb64(encoded_header))
        claims = json.loads(_unb64(encoded_claims))
        if header != {"alg": "HS256", "typ": "JWT"}:
            return None
        if not isinstance(claims, dict) or int(claims.get("exp", 0)) <= int(time.time()):
            return None
        return claims
    except (ValueError, TypeError, json.JSONDecodeError, binascii.Error):
        return None


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
