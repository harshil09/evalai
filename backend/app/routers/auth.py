import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import CurrentUser, get_current_user
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    profile = await _fetch_profile(current_user.id)

    return {
        "id": current_user.id,
        "email": profile.get("email") or current_user.email,
        "first_name": profile.get("first_name") or current_user.first_name,
        "last_name": profile.get("last_name") or current_user.last_name,
        "plan": profile.get("plan", "free"),
        "subscription_status": profile.get("subscription_status", "none"),
    }


async def _fetch_profile(user_id: str) -> dict:
    supabase_url = settings["supabase_url"].rstrip("/")
    service_role_key = settings["supabase_service_role_key"]

    if not supabase_url or not service_role_key:
        return {}

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "*"},
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not load profile from Supabase",
        )

    rows = response.json()
    if not rows:
        return {}

    return rows[0]
