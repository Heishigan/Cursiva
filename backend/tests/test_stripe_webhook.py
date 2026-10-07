import hashlib
import hmac
import json
import os
import time

import pytest

from tests.conftest import get_credits, set_credits

PRICE = "price_test_pack"


@pytest.fixture(autouse=True)
def price(monkeypatch):
    monkeypatch.setenv("STRIPE_PRICE_ID", PRICE)


def _session(sid="cs_1", user="user_A", status="paid", meta=True):
    s = {"object": "checkout.session", "id": sid, "client_reference_id": user, "payment_status": status}
    if meta:
        s["metadata"] = {"product": "cursiva_credits", "price_id": PRICE, "credits": "15"}
    return s


def _post(client, evt_id, session, etype="checkout.session.completed"):
    payload = json.dumps({"id": evt_id, "object": "event", "type": etype, "data": {"object": session}})
    ts = str(int(time.time()))
    secret = os.environ["STRIPE_WEBHOOK_SECRET"]
    sig = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return client.post("/api/webhook", content=payload,
                       headers={"stripe-signature": f"t={ts},v1={sig}", "content-type": "application/json"})


def test_grants_credits_once_on_redelivery(client):
    set_credits("user_A", 0)
    for _ in range(3):
        assert _post(client, "evt_1", _session()).status_code == 200
    assert get_credits("user_A") == 15


def test_second_event_for_same_session_does_not_double_grant(client):
    set_credits("user_A", 0)
    _post(client, "evt_1", _session())
    _post(client, "evt_2", _session(), etype="checkout.session.async_payment_succeeded")
    assert get_credits("user_A") == 15


def test_unpaid_session_grants_nothing(client):
    set_credits("user_A", 0)
    assert _post(client, "evt_1", _session(status="unpaid")).status_code == 200
    assert get_credits("user_A") == 0


def test_async_success_after_pending(client):
    set_credits("user_A", 0)
    _post(client, "evt_1", _session(status="unpaid"))
    _post(client, "evt_2", _session(status="paid"), etype="checkout.session.async_payment_succeeded")
    assert get_credits("user_A") == 15


def test_promo_code_free_checkout_counts(client):
    set_credits("user_A", 0)
    _post(client, "evt_1", _session(status="no_payment_required"))
    assert get_credits("user_A") == 15


def test_foreign_session_without_metadata_checked_against_line_items(client, app_module, monkeypatch):
    set_credits("user_A", 0)
    monkeypatch.setattr(app_module.stripe.checkout.Session, "list_line_items",
                        lambda sid, limit=10: {"data": [{"quantity": 1, "price": {"id": "price_other_product"}}]})
    _post(client, "evt_1", _session(meta=False))
    assert get_credits("user_A") == 0


def test_legacy_session_without_metadata_with_our_price(client, app_module, monkeypatch):
    set_credits("user_A", 0)
    monkeypatch.setattr(app_module.stripe.checkout.Session, "list_line_items",
                        lambda sid, limit=10: {"data": [{"quantity": 1, "price": {"id": PRICE}}]})
    _post(client, "evt_1", _session(meta=False))
    assert get_credits("user_A") == 15


def test_new_user_gets_pack_without_trial_bonus(client):
    _post(client, "evt_1", _session(user="user_NEW"))
    assert get_credits("user_NEW") == 15


def test_bad_signature_rejected(client):
    payload = json.dumps({"id": "evt_x", "type": "checkout.session.completed", "data": {"object": _session()}})
    r = client.post("/api/webhook", content=payload, headers={"stripe-signature": "t=1,v1=deadbeef"})
    assert r.status_code == 400
