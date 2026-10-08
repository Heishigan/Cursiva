# Purging personal data and secrets from git history

The `audit/fixes` branch stops tracking the files below, but **they are still in
every earlier commit** on GitHub. Rotate the secrets first, because a history
rewrite doesn't un-leak anything that was already cloned or cached.

## 1. Rotate first (do this before anything else)
- Supabase database password (it was committed in `handoff.md`). Update `DATABASE_URL` in Cloud Run.
- Treat the Fernet key that was in `backend/security.py` as public. If any backup still has the dropped
  `encrypted_api_key` column, those user OpenAI keys can be decrypted, so delete those backups or ask the affected users to rotate.

## 2. Rewrite history (destructive: every commit SHA changes)
Run from a fresh mirror clone, not from your working copy:

```bash
pip install git-filter-repo
git clone --mirror https://github.com/Heishigan/Cursiva.git cursiva-purge
cd cursiva-purge
git filter-repo --invert-paths \
  --path handoff.md \
  --path temp/ \
  --path "Application Tracking Sheet.xlsx" \
  --path import_applications.sql \
  --path generate_sql.py \
  --path backend/import.log \
  --path stripe.zip \
  --path stripe_cli/ \
  --path chrome_extension/chrome_extension.zip \
  --path backend/engine_patched.py \
  --path rebase_editor.py --path rebase_editor_v2.py --path rebase_editor_v3.py \
  --path commit_msg_editor.py \
  --path backend/security.py
git push --force --mirror
```

## 3. Afterwards
- Everyone with a clone must re-clone (old clones would push the data back).
- Ask GitHub Support to purge cached views and pull-request refs for the removed paths.
- Check forks of the repository; a history rewrite doesn't reach them.
