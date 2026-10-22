from pathlib import Path


def process_image(
    source: Path,
    output: Path,
    *,
    remove_bg: bool = False,
    enhance: bool = False,
) -> Path:
    result = source

    if remove_bg:
        result = remove_background(result, output)

    if enhance:
        result = enhance_image(result, output)

    return result


def remove_background(
    source: Path,
    output: Path,
) -> Path:
    # TODO: integrasikan library rembg.
    raise NotImplementedError


def enhance_image(
    source: Path,
    output: Path,
) -> Path:
    raise NotImplementedError