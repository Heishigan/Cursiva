import os
import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from fastapi import Header, HTTPException

# Cache of PyJWKClient instances keyed by issuer URL.
# This handles multiple Clerk instances (dev vs prod) dynamically — the backend
# derives the correct JWKS URL from the `iss` claim inside the JWT itself,
# so it works regardless of which Clerk frontend instance signs the token.
_jwks_clients: dict[str, PyJWKClient] = {}

def _get_jwks_client(issuer: str) -> PyJWKClient:
    """Return a cached PyJWKClient for the given Clerk issuer URL."""
    if issuer not in _jwks_clients:
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        _jwks_clients[issuer] = PyJWKClient(jwks_url, cache_keys=True, lifespan=300)
    return _jwks_clients[issuer]

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        # Step 1: Decode header + payload WITHOUT signature verification to get
        # the `iss` (issuer) claim. This tells us which Clerk instance signed
        # the token so we can fetch the correct JWKS URL dynamically.
        unverified = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["RS256"]
        )
        issuer = unverified.get("iss")
        if not issuer:
            raise HTTPException(status_code=401, detail="Token missing issuer (iss) claim")

        # Step 2: Get (or create) the PyJWKClient for this issuer.
        jwks_client = _get_jwks_client(issuer)

        # Step 3: Look up the signing key. If not in cache (e.g. after a key
        # rotation), force a fresh JWKS fetch and retry once.
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except PyJWKClientError:
            jwks_client.fetch_data()  # force cache refresh
            signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Step 4: Fully verify the token — signature, expiry, nbf, etc.
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            leeway=60  # tolerate up to 60s clock skew (Cloud Run vs Clerk)
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload: missing sub")
        return user_id

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token error: {e}")
