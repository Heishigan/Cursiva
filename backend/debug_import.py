import sys
print("1")
from fastapi import FastAPI
print("2")
from slowapi import Limiter, _rate_limit_exceeded_handler
print("3")
from core.models import FullCVData
print("4")
from core.agent import setup_node
print("5")
from database import engine
print("6")
from security import encrypt_key
print("7")
from auth import get_current_user_id
print("8")
import main
print("DONE")
