import yt_dlp
import json

def download_video(url: str, resolution: int) -> None:
    option = {
        'quiet': True,
        'no_warnings': True,
        'format': (
            f'bestvideo[height<={resolution}]+bestaudio/'
            f'best[height<={resolution}]/best'
        ),
        'merge_output_format': 'mp4',
    }
    with yt_dlp.YoutubeDL(option) as yt:
        yt.download([url])

def download_audio(url: str) -> None:
    option = {
        'quiet': True,
        'no_warning': True,
        'format': 'bestaudio',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    with yt_dlp.YoutubeDL(option) as yt:
        yt.download(url)

def get_resolution_list(url: str) -> list[str]:
    option = {
        'quiet': True,
        'no_warning': True
    }

    with yt_dlp.YoutubeDL(option) as yt:
        info = yt.extract_info(url, download=False)

        resolutions = set()
        for fmt in info['formats']:
            if fmt.get('vcodec') in (None, 'none', 'images'):
                continue

            height = fmt.get('height')
            if height:
                resolutions.add(height)

        return sorted(resolutions, reverse=True)

def main():
    with open("file.json") as f:
        request = json.load(f)

    video_url = request['url']

    if request['audio_only']:
        download_audio(url=video_url)
        return

    # print(get_resolution_list(video_url))

    download_video(url=video_url, resolution=request['resolution'])

if __name__ == "__main__":
    main()