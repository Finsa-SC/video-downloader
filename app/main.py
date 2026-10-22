from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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

# harus paling bawah, setelah include_router
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")