import mimetypes
import shutil
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from starlette.responses import FileResponse

from app.services import Downloader

router = APIRouter()


class CleanupFileResponse(FileResponse):
    def __init__(self, *args, cleanup_dir: Path, **kwargs):
        super().__init__(*args, **kwargs)
        self.cleanup_dir = cleanup_dir

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # Keep run if sending failed or canceled
            shutil.rmtree(self.cleanup_dir, ignore_errors=True)


class DownloadRequest(BaseModel):
    url: HttpUrl
    mode: Literal["video", "video_only", "audio_only"]
    resolution: int | None = Field(default=None, gt=0)


@router.get("/info")
def get_video_info(url: HttpUrl):
    try:
        downloader = Downloader(str(url), output_dir=".")
        return downloader.get_video_info()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve video information.",
        ) from exc


@router.post("/download")
def download(request: DownloadRequest):
    if (
        request.mode in ("video", "video_only")
        and request.resolution is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Resolution is required for video modes.",
        )

    # Each request get isolated directory
    temp_dir = Path(tempfile.mkdtemp(prefix="video-downloader-"))

    try:
        downloader = Downloader(
            str(request.url),
            output_dir=temp_dir,
        )

        match request.mode:
            case "video":
                file_path = downloader.download_video(
                    request.resolution
                )

            case "video_only":
                file_path = downloader.download_video(
                    request.resolution,
                    no_audio=True,
                )

            case "audio_only":
                file_path = downloader.download_audio()

        media_type = (
            mimetypes.guess_type(file_path.name)[0]
            or "application/octet-stream"
        )

        return CleanupFileResponse(
            path=file_path,
            filename=file_path.name,
            media_type=media_type,
            cleanup_dir=temp_dir,
        )

    except Exception as exc:
        # If download failed before return response
        shutil.rmtree(temp_dir, ignore_errors=True)

        raise HTTPException(
            status_code=500,
            detail="Download failed.",
        ) from exc
