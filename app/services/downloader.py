from pathlib import Path
import yt_dlp


class Downloader:
    def __init__(self, url: str, output_dir: str | Path):
        self.url = url
        self.output_dir = Path(output_dir)

    def _download(self, options: dict) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)

        options = {
            **options,
            "outtmpl": str(
                self.output_dir / "%(title).200B [%(id)s].%(ext)s"
            ),
        }

        with yt_dlp.YoutubeDL(options) as yt:
            yt.download([self.url])

        ignored_suffixes = {
            ".part", ".ytdl", ".temp", ".json",
            ".jpg", ".jpeg", ".png", ".webp",
            ".vtt", ".srt", ".ass", ".lrc",
            ".description",
        }

        candidates = [
            path
            for path in self.output_dir.iterdir()
            if path.is_file()
            and path.suffix.lower() not in ignored_suffixes
            and not path.name.endswith(".part")
        ]

        if not candidates:
            raise RuntimeError("Downloaded media file was not found.")

        return max(candidates, key=lambda path: path.stat().st_size)

    def download_video(
        self,
        resolution: int,
        no_audio: bool = False,
    ) -> Path:
        if no_audio:
            format_selector = (
                f"bestvideo[height<={resolution}]"
            )
        else:
            format_selector = (
                f"bestvideo[height<={resolution}]+bestaudio/"
                f"best[height<={resolution}]"
            )

        return self._download({
            "quiet": True,
            "no_warnings": True,
            "format": format_selector,
            "merge_output_format": "mp4",
        })

    def download_audio(self) -> Path:
        return self._download({
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio/best",
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }],
        })

    def get_video_info(self) -> dict:
        options = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        with yt_dlp.YoutubeDL(options) as yt:
            info = yt.extract_info(self.url, download=False)

        resolutions = {
            fmt["height"]
            for fmt in info.get("formats", [])
            if fmt.get("vcodec") not in (None, "none", "images")
               and fmt.get("height")
        }

        return {
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "resolutions": sorted(resolutions, reverse=True),
        }