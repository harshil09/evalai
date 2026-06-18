from functools import lru_cache
from typing import Annotated, TypedDict

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import get_settings

security = HTTPBearer()
settings = get_settings()

JWKS_ALGORITHMS = ("ES256", "RS256", "EdDSA", "HS256")


class CurrentUser(TypedDict):
    id: str
    email: str | None
    first_name: str | None
    last_name: str | None


@lru_cache(maxsize=4)
def _fetch_jwks(supabase_url: str) -> dict:
    response = httpx.get(
        f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _decode_with_jwks(token: str, supabase_url: str) -> dict:
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")
    key_id = header.get("kid")

    if not algorithm or not key_id:
        raise JWTError("Token header missing alg or kid")

    jwks = _fetch_jwks(supabase_url)
    signing_key = None

    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == key_id:
            signing_key = jwk.construct(key_data)
            break

    if signing_key is None:
        raise JWTError("No matching signing key found in JWKS")

    return jwt.decode(
        token,
        signing_key,
        algorithms=[algorithm],
        audience="authenticated",
    )


def _decode_with_legacy_secret(token: str, jwt_secret: str) -> dict:
    return jwt.decode(
        token,
        jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def verify_supabase_token(token: str) -> dict:
    supabase_url = settings["supabase_url"]
    jwt_secret = settings["supabase_jwt_secret"]

    errors: list[str] = []

    if supabase_url:
        try:
            return _decode_with_jwks(token, supabase_url)
        except Exception as exc:
            errors.append(f"JWKS: {exc}")

    if jwt_secret:
        try:
            return _decode_with_legacy_secret(token, jwt_secret)
        except JWTError as exc:
            errors.append(f"HS256: {exc}")

    if not supabase_url and not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured for JWT verification",
        )

    raise JWTError("; ".join(errors) or "Unable to verify token")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> CurrentUser:
    token = credentials.credentials

    try:
        payload = verify_supabase_token(token)
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user_metadata = payload.get("user_metadata") or {}

    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        first_name=user_metadata.get("first_name"),
        last_name=user_metadata.get("last_name"),
    )
