"""Free-trial credit, granted at most once per verified email address.

The email comes from Clerk's Backend API (verified primary address), never
from the request body: a client could previously omit or invent the email and
get a fresh trial credit for every new account. Hashes in used_trial_emails
are kept when an account is deleted, so delete-and-recreate with the same
address gets no second trial.
"""
import hashlib
import logging
import os

import requests

logger = logging.getLogger(__name__)

TRIAL_CREDITS = 1
CLERK_API_URL = os.environ.get("CLERK_API_URL", "https://api.clerk.com/v1")


def normalize_email(email: str) -> str:
    """Collapse common aliases so one inbox counts once.

    Lower-cases, drops a "+tag" in the local part, and for Gmail removes dots
    and maps googlemail.com to gmail.com.
    """
    email = (email or "").strip().lower()
    if "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def email_hashes(email: str) -> tuple[str, str]:
    """(normalized hash, legacy hash). The legacy form, sha256(lower(strip)),
    is what earlier versions stored, so both are checked."""
    norm = hashlib.sha256(normalize_email(email).encode()).hexdigest()
    legacy = hashlib.sha256((email or "").lower().strip().encode()).hexdigest()
    return norm, legacy


def fetch_verified_primary_email(user_id: str) -> str | None:
    """Return the user's verified primary email from Clerk, or None."""
    secret = os.environ.get("CLERK_SECRET_KEY")
    if not secret:
        logger.error("CLERK_SECRET_KEY is not set; cannot verify trial eligibility")
        return None
    try:
        r = requests.get(f"{CLERK_API_URL}/users/{user_id}",
                         headers={"Authorization": f"Bearer {secret}"}, timeout=5)
        r.raise_for_status()
        user = r.json()
    except Exception as e:
        logger.error("Clerk user lookup failed for %s: %s", user_id, type(e).__name__)
        return None
    primary_id = user.get("primary_email_address_id")
    for addr in user.get("email_addresses") or []:
        if addr.get("id") == primary_id and (addr.get("verification") or {}).get("status") == "verified":
            return addr.get("email_address")
    return None


def starting_credits_for_new_profile(db, user_id: str) -> int:
    """Decide the trial for a brand-new profile and record the email hash.

    No verified email (or a Clerk outage) means no trial: we fail closed and
    log it rather than hand out an unverifiable credit.
    """
    from models import UsedTrialEmail

    email = fetch_verified_primary_email(user_id)
    if not email:
        return 0
    norm, legacy = email_hashes(email)
    used = db.query(UsedTrialEmail).filter(UsedTrialEmail.email_hash.in_([norm, legacy])).first()
    if used:
        return 0
    db.add(UsedTrialEmail(email_hash=norm))
    return TRIAL_CREDITS
