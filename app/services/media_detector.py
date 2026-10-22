import httpx
from bs4 import BeautifulSoup

from app.services.downloader import Downloader
from app.services.image_downloader import normalize_image_url


def detect_media(url: str) -> dict:
    url = normalize_image_url(url)

    try:
        response = httpx.get(
            url,
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()

        content_type = response.headers.get(
            "content-type", ""
        ).split(";")[0].lower()

        if content_type.startswith("image/"):
            return {
                "type": "image",
                "image_url": str(response.url),
                "content_type": content_type,
            }

        if "text/html" in content_type:
            soup = BeautifulSoup(response.text, "html.parser")

            image = soup.find(
                "meta",
                property="og:image",
            )

            if image and image.get("content"):
                image_url = image["content"]

                if "pin.it" in str(response.url) or (
                    "pinterest." in str(response.url)
                ):
                    return {
                        "type": "image",
                        "image_url": image_url,
                        "content_type": "image",
                    }

    except httpx.HTTPError:
        pass

    downloader = Downloader(url, output_dir=".")
    info = downloader.get_video_info()

    return {
        "type": "video",
        "details": info,
    }