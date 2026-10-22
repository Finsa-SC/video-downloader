from fastapi import FastAPI
from app.routes.download import router as download_router

app = FastAPI(
    title="Video Downloader API",
    version="1.0.0",
)

app.include_router(
    download_router,
    prefix="/api",
    tags=["Download"],
)