from fastapi import APIRouter, HTTPException
from pydantic import HttpUrl

from app.services.media_detector import detect_media

router = APIRouter()


@router.get("/info")
def get_media_info(url: HttpUrl):
    try:
        return detect_media(str(url))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to identify the media at this URL.",
        ) from exc