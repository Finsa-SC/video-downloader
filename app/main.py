from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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

# harus paling bawah, setelah include_router
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")