from fastapi import FastAPI
from app.routes import download, info

app = FastAPI(
    title="Video Downloader API",
    version="1.0.0",
)

app.include_router(
    info.router,
    prefix="/api",
    tags=["Media Info"],
)

app.include_router(
    download.router,
    prefix="/api",
    tags=["Download"],
)
