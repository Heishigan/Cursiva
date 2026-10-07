import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jwt.algorithms import RSAAlgorithm

import auth

TRUSTED = auth.TRUSTED_ISSUERS[0]


def _key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwk(key, kid):
    d = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
    d.update(kid=kid, use="sig", alg="RS256")
    return d


class _FakeJWKS:
    def __init__(self, key, kid="k1"):
        self._k = jwt.PyJWK(_jwk(key, kid))

    def get_signing_key_from_jwt(self, token):
        return self._k

    def fetch_data(self):
        pass


def _token(key, kid="k1", **claims):
    now = int(time.time())
    body = {"iss": TRUSTED, "sub": "user_REAL", "iat": now, "exp": now + 600}
    body.update(claims)
    body = {k: v for k, v in body.items() if v is not None}
    return jwt.encode(body, key, algorithm="RS256", headers={"kid": kid})


@pytest.fixture()
def clerk_key(monkeypatch):
    key = _key()
    monkeypatch.setitem(auth._jwks_clients, TRUSTED, _FakeJWKS(key))
    return key


def _call(tok):
    return auth.get_current_user_id("Bearer " + tok)


def test_valid_token_returns_sub(clerk_key):
    assert _call(_token(clerk_key)) == "user_REAL"


def test_forged_token_from_attacker_issuer_rejected_without_fetch(clerk_key):
    """Regression for the account-takeover PoC: attacker-hosted JWKS must never be fetched."""
    attacker = _key()
    hits = []

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"keys": [_jwk(attacker, "evil")]}).encode())

        def log_message(self, *a):
            pass

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        tok = _token(attacker, kid="evil", iss=f"http://127.0.0.1:{srv.server_address[1]}", sub="user_VICTIM")
        with pytest.raises(HTTPException) as e:
            _call(tok)
        assert e.value.status_code == 401
        assert hits == []
    finally:
        srv.shutdown()


def test_wrong_signature_rejected(clerk_key):
    with pytest.raises(HTTPException):
        _call(_token(_key()))


def test_missing_exp_rejected(clerk_key):
    with pytest.raises(HTTPException):
        _call(_token(clerk_key, exp=None))


def test_unexpected_azp_rejected(clerk_key):
    with pytest.raises(HTTPException):
        _call(_token(clerk_key, azp="https://evil.example"))


def test_allowed_azp_accepted(clerk_key):
    assert _call(_token(clerk_key, azp="https://cursiva.se")) == "user_REAL"


def test_error_detail_is_generic(clerk_key):
    with pytest.raises(HTTPException) as e:
        _call("not-a-jwt")
    assert "Token error" not in e.value.detail


def test_startup_fails_closed_without_issuer(monkeypatch):
    monkeypatch.delenv("CLERK_ISSUER", raising=False)
    monkeypatch.delenv("CLERK_ALLOWED_ISSUERS", raising=False)
    with pytest.raises(RuntimeError):
        auth._load_trusted_issuers()


def test_legacy_env_alias(monkeypatch):
    monkeypatch.delenv("CLERK_ISSUER", raising=False)
    monkeypatch.setenv("CLERK_ALLOWED_ISSUERS", "https://a.example/, https://b.example")
    assert auth._load_trusted_issuers() == ["https://a.example", "https://b.example"]
