import os

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:password@localhost/InfoField"
)
TG_CHANNEL_NAME = os.getenv("TG_CHANNEL_NAME", "wearesiriusuniversity")
VK_GROUP_NAME = os.getenv("VK_GROUP_NAME", "siriusuniversity")
