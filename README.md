# OmaYoutube-dl

Search YouTube, preview audio, and download videos / audios / playlists straight from the Omarchy bar.

Built for the Omarchy Quattro shell as a `bar-widget` with a nested details panel.

## Install

```sh
omarchy plugin add https://github.com/homodeus/omayoutube-dl.git --enable
```

Requires system tools (already on most Omarchy installs):

```sh
command -v yt-dlp mpv ffmpeg socat
```

## Usage

- Click the `YT` bar button to open the panel.
- **Search tab**: type a query, hit Search. Each result shows thumbnail, title, channel, duration.
  - `Watch` plays the video EMBEDDED in the panel (progressive mp4 stream, with seek bar).
  - `Download` queues the item for download (auto-switches to Downloads tab).
- **Direct URL**: paste a video or playlist URL, hit Queue.
- **Player card**: Play/Pause, Stop, seek slider with time labels, `Player` opens the video in the
  system default player, `mpv` opens it fullscreen in mpv. If a video has no embeddable stream
  (DASH-only uploads), the panel falls back to an mpv audio preview automatically.
- **Downloads tab**: live progress bar with big % readout, current-file detail line, up-next queue,
  completed history, cancel, open-folder.
- **Settings tab**: download folder, video quality (best → 360p), audio format (mp3/m4a/opus/flac/wav), video container (mp4/mkv/webm), results per search, playlist vs single mode, dependency check.

Playback controls use `mpv --input-ipc-server=/tmp/omayoutube-mpv.sock` + `socat` for pause toggling.

## Configure

Settings persist inline in `~/.config/omarchy/shell.json` on the plugin entry:

| key | default | meaning |
|---|---|---|
| `downloadDir` | `~/Videos/Omayoutube` | download target |
| `quality` | `1080` | max video height |
| `audioFormat` | `mp3` | audio extract format |
| `videoFormat` | `mp4` | remux container |
| `dlMode` | `video` | `video` or `audio` |
| `playlistMode` | `single` | `single` or `playlist` |
| `maxResults` | `10` | search result count |

Move the widget:

```sh
omarchy bar move io.github.homodeus.omayoutube-dl --section right
```

## Remove

```sh
omarchy plugin remove io.github.homodeus.omayoutube-dl
```

Killing the panel stops the audio preview. Cancelling downloads stops yt-dlp; partial `.part` files stay in the download folder for resume.
