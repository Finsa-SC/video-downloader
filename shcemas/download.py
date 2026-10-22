from typing import Literal
from pydantic import BaseModel, Field, HttpUrl


class DownloadRequest(BaseModel):
    url: HttpUrl

    mode: Literal["video", "video_only", "audio_only"] | None = None

    resolution: int | None = Field(default=None, gt=0)

    remove_bg: bool = False
    enhance: bool = False