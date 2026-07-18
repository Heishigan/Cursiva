import os
import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from fastapi import Header, HTTPException

# Use the known Clerk domain from frontend/.env.local
CLERK_DOMAIN = os.getenv("CLERK_DOMAIN", "known-glider-6.clerk.accounts.dev")
JWKS_URL = f"https://{CLERK_DOMAIN}/.well-known/jwks.json"
# cache_keys=True with lifespan=300 so the JWKS cache auto-refreshes every 5 minutes
jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=300)

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        # Cryptographically verify the JWT signature using Clerk's public JWKS.
        # If the signing key is not found in the cache (e.g. after a key rotation),
        # force a fresh fetch from the JWKS endpoint and retry once.
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except PyJWKClientError:
            jwks_client.fetch_data()  # force cache refresh
            signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}, # Accept standard Clerk audience
            leeway=60 # Add leeway to account for clock skew between Clerk and Google Cloud Run
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token error: {e}")
