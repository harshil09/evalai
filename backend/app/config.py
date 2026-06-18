import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_settings():
    return {
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_service_role_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        "supabase_jwt_secret": os.getenv("SUPABASE_JWT_SECRET", ""),
        "cors_origins": os.getenv(
            "CORS_ORIGINS", "http://localhost:3000"
        ).split(","),
    }
