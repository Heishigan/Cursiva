import logging
import os

import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError

logger = logging.getLogger(__name__)

_DEFAULT_ORIGINS = "http://localhost:3000,https://cursiva.se,https://www.cursiva.se"


def _split(value: str) -> list[str]:
    return [v.strip().rstrip("/") for v in value.split(",") if v.strip()]


def _load_trusted_issuers() -> list[str]:
    """Issuers are pinned in config, never taken from the token.

    CLERK_ISSUER (comma-separated, e.g. "https://clerk.cursiva.se") is the
    setting. CLERK_ALLOWED_ISSUERS is accepted as a legacy alias so existing
    deployments keep working. With neither set the service refuses to start:
    previously an empty allow-list meant *any* issuer was trusted, which let an
    attacker sign tokens with their own key and impersonate any user.
    """
    issuers = _split(os.environ.get("CLERK_ISSUER", "")) or _split(os.environ.get("CLERK_ALLOWED_ISSUERS", ""))
    if not issuers:
        raise RuntimeError("CLERK_ISSUER must be set (comma-separated list of trusted Clerk issuer URLs)")
    for iss in issuers:
        if not iss.startswith("https://") and os.environ.get("ENV") == "production":
            raise RuntimeError(f"Clerk issuer must use https in production: {iss}")
    return issuers


TRUSTED_ISSUERS: list[str] = _load_trusted_issuers()
AUTHORIZED_PARTIES: set[str] = set(
    _split(os.environ.get("CLERK_AUTHORIZED_PARTIES", "")) or _split(os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ORIGINS))
)

# One JWKS client per pinned issuer, built once. The set is fixed at startup,
# so the server never fetches a URL chosen by the token's author.
_jwks_clients: dict[str, PyJWKClient] = {
    iss: PyJWKClient(f"{iss}/.well-known/jwks.json", cache_keys=True, lifespan=300)
    for iss in TRUSTED_ISSUERS
}

_UNAUTHORIZED = HTTPException(status_code=401, detail="Invalid or expired session token")


def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    try:
        # The unverified read is only used to pick one of the *pinned* JWKS
        # clients; the issuer is verified again below with the signature.
        unverified_iss = str(jwt.decode(token, options={"verify_signature": False}).get("iss", "")).rstrip("/")
        jwks_client = _jwks_clients.get(unverified_iss)
        if jwks_client is None:
            logger.warning("Rejected token from untrusted issuer")
            raise _UNAUTHORIZED

        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except PyJWKClientError:
            jwks_client.fetch_data()  # key rotation: refresh once
            signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=unverified_iss,
            options={"verify_aud": False, "require": ["exp", "iat", "iss", "sub"]},
            leeway=60,  # tolerate clock skew between Cloud Run and Clerk
        )
        azp = payload.get("azp")
        if azp is not None and str(azp).rstrip("/") not in AUTHORIZED_PARTIES:
            logger.warning("Rejected token with unexpected azp")
            raise _UNAUTHORIZED
        return payload["sub"]
    except HTTPException:
        raise
    except Exception as e:
        logger.info("Token verification failed: %s", type(e).__name__)
        raise _UNAUTHORIZED
