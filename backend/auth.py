import os
import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

# Use the known Clerk domain from frontend/.env.local
CLERK_DOMAIN = os.getenv("CLERK_DOMAIN", "known-glider-6.clerk.accounts.dev")
JWKS_URL = f"https://{CLERK_DOMAIN}/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        # Cryptographically verify the JWT signature using Clerk's public JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False} # Accept standard Clerk audience
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token error: {e}")
