import os
from cryptography.fernet import Fernet

import sys
SECRET_KEY = os.environ.get("DB_ENCRYPTION_KEY")
if not SECRET_KEY:
    if os.environ.get("ENV") == "production":
        print("WARNING: DB_ENCRYPTION_KEY is not set in production. Using fallback.", file=sys.stderr)
        SECRET_KEY = b'G-oE8hHqDkSjF4y_7I1v-M1bZt1D2W3QkY6O9A-fXmU='
    else:
        # Dev-only fallback with a clear warning
        print("WARNING: DB_ENCRYPTION_KEY not set — using insecure dev key.", file=sys.stderr)
        SECRET_KEY = b'G-oE8hHqDkSjF4y_7I1v-M1bZt1D2W3QkY6O9A-fXmU='

cipher_suite = Fernet(SECRET_KEY)

def encrypt_key(plain_text: str) -> str:
    if not plain_text:
        return ""
    return cipher_suite.encrypt(plain_text.encode('utf-8')).decode('utf-8')

def decrypt_key(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    return cipher_suite.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
