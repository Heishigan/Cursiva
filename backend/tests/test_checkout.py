import types


def test_checkout_session_params(client, app_module, monkeypatch):
    seen = {}

    def fake_create(**kwargs):
        seen.update(kwargs)
        return types.SimpleNamespace(url="https://checkout.stripe.test/s")

    monkeypatch.setenv("STRIPE_PRICE_ID", "price_test_pack")
    monkeypatch.setattr(app_module.stripe.checkout.Session, "create", fake_create)
    r = client.post("/api/create-checkout-session")
    assert r.status_code == 200 and r.json()["url"].startswith("https://")
    # Rejected by current Stripe API versions ("no longer supported").
    assert "payment_method_types" not in seen
    assert seen["client_reference_id"] == "user_A"
    assert seen["metadata"] == {"product": "cursiva_credits", "price_id": "price_test_pack", "credits": "15"}
    assert seen["allow_promotion_codes"] is True


def test_checkout_stripe_error_is_502_without_details(client, app_module, monkeypatch):
    def boom(**kwargs):
        raise app_module.stripe.error.InvalidRequestError("secret detail", "param")
    monkeypatch.setattr(app_module.stripe.checkout.Session, "create", boom)
    r = client.post("/api/create-checkout-session")
    assert r.status_code == 502 and "secret detail" not in r.text
