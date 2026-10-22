from typing import Any, Literal
from pydantic import BaseModel


class MediaInfo(BaseModel):
    type: Literal["image", "video"]
    filename: str | None = None
    details: dict[str, Any] = {}