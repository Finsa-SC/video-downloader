from pathlib import Path
from tempfile import mkdtemp
import shutil
import httpx
from urllib.parse import urlparse, parse_qs, unquote


def normalize_image_url(url: str) -> str:
    parsed = urlparse(url)

    if parsed.hostname == "external-content.duckduckgo.com":
        params = parse_qs(parsed.query)
        original_url = params.get("u", [None])[0]

        if original_url:
            return unquote(original_url)

    return url


def download_image(url: str) -> tuple[Path, Path]:
    url = normalize_image_url(url)
    temp_dir = Path(mkdtemp(prefix="image-downloader-"))

    try:
        with httpx.stream(
            "GET",
            url,
            follow_redirects=True,
            timeout=30,
        ) as response:
            response.raise_for_status()

            content_type = response.headers.get(
                "content-type", ""
            ).split(";")[0].lower()

            if not content_type.startswith("image/"):
                raise ValueError("URL does not return an image.")

            max_size = 20 * 1024 * 1024
            size = 0
            file_path = temp_dir / "original_image"

            with file_path.open("wb") as file:
                for chunk in response.iter_bytes():
                    size += len(chunk)

                    if size > max_size:
                        raise ValueError("Image exceeds size limit.")

                    file.write(chunk)

        return file_path, temp_dir

    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise