
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

load_dotenv()

REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg"


def process_image(
    source: Path,
    output: Path,
    *,
    remove_bg: bool = False,
    enhance: bool = False,
) -> Path:
    if not remove_bg and not enhance:
        return source

    output.parent.mkdir(parents=True, exist_ok=True)

    result = source
    intermediate: Path | None = None

    try:
        if remove_bg:
            # Use a separate file so enhancement can safely read it.
            intermediate = (
                output.with_name(f"{output.stem}.no-bg.png")
                if enhance
                else output
            )
            result = remove_background(result, intermediate)

        if enhance:
            result = enhance_image(result, output)

        return result

    finally:
        if intermediate is not None and intermediate != output:
            intermediate.unlink(missing_ok=True)


def remove_background(
    source: Path,
    output: Path,
) -> Path:
    api_key = os.getenv("REMOVE_BG_API_KEY")

    if not api_key:
        raise RuntimeError("REMOVE_BG_API_KEY is not configured.")

    with source.open("rb") as image_file:
        response = httpx.post(
            REMOVE_BG_API_URL,
            headers={"X-Api-Key": api_key},
            files={
                "image_file": (
                    source.name,
                    image_file,
                    "application/octet-stream",
                )
            },
            data={"size": "auto"},
            timeout=120,
        )

    if not response.is_success:
        try:
            detail = response.json().get("errors", [])
        except ValueError:
            detail = response.text[:500]

        raise RuntimeError(
            f"remove.bg API failed ({response.status_code}): {detail}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(response.content)

    return output


def enhance_image(
    source: Path,
    output: Path,
) -> Path:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)

        has_alpha = (
            image.mode in ("RGBA", "LA")
            or "transparency" in image.info
        )

        image = image.convert("RGBA" if has_alpha else "RGB")

        image = ImageEnhance.Contrast(image).enhance(1.10)
        image = ImageEnhance.Color(image).enhance(1.08)
        image = ImageEnhance.Sharpness(image).enhance(1.15)
        image = image.filter(
            ImageFilter.UnsharpMask(
                radius=1.2,
                percent=110,
                threshold=3,
            )
        )

        image.save(output, format="PNG")

    return output
