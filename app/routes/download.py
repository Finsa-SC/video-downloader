
import mimetypes
import shutil
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from starlette.responses import FileResponse

from app.services import Downloader
from app.services.image_downloader import download_image
from app.services.image_processor import process_image
from app.services.media_detector import detect_media

router = APIRouter()


class CleanupFileResponse(FileResponse):
    def __init__(self, *args, cleanup_dir: Path, **kwargs):
        super().__init__(*args, **kwargs)
        self.cleanup_dir = cleanup_dir

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            shutil.rmtree(self.cleanup_dir, ignore_errors=True)


class DownloadRequest(BaseModel):
    url: HttpUrl
    mode: Literal[
        "original", "video", "video_only", "audio_only"
    ] = "original"
    resolution: int | None = Field(default=None, gt=0)
    remove_bg: bool = False
    enhance: bool = False


@router.post("/download")
def download(request: DownloadRequest):
    temp_dir: Path | None = None

    try:
        media = detect_media(str(request.url))

        if media["type"] == "image":
            image_url = media.get("image_url", str(request.url))

            source_path, temp_dir = download_image(image_url)
            file_path = source_path

            if request.remove_bg or request.enhance:
                output_path = temp_dir / "processed.png"

                file_path = process_image(
                    source_path,
                    output_path,
                    remove_bg=request.remove_bg,
                    enhance=request.enhance,
                )

            content_type = (
                "image/png"
                if request.remove_bg or request.enhance
                else media.get("content_type", "image/jpeg")
            )

            extension = mimetypes.guess_extension(content_type) or ".img"

            return CleanupFileResponse(
                path=file_path,
                filename=f"image{extension}",
                media_type=content_type,
                cleanup_dir=temp_dir,
            )

        if request.mode == "original":
            raise HTTPException(
                status_code=422,
                detail="Select a video download mode.",
            )

        if (
            request.mode in ("video", "video_only")
            and request.resolution is None
        ):
            raise HTTPException(
                status_code=422,
                detail="Resolution is required for video modes.",
            )

        temp_dir = Path(
            tempfile.mkdtemp(prefix="video-downloader-")
        )

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

    except HTTPException:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    except Exception as exc:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)

        raise HTTPException(
            status_code=500,
            detail="Download failed.",
        ) from exc
