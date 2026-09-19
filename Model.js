// OmaYoutube-dl helpers: parsing + command builders. Pure JS, no Qt deps.

function parseSearchJson(raw) {
  var out = [];
  try {
    var doc = JSON.parse(raw);
    var entries = doc.entries || [];
    for (var i = 0; i < entries.length; ++i) {
      var e = entries[i] || {};
      if (!e.id) continue;
      var dur = e.duration_string || "";
      if (!dur && e.duration) dur = formatDuration(e.duration);
      out.push({
        id: String(e.id),
        title: String(e.title || "Untitled"),
        channel: String(e.channel || e.uploader || "Unknown"),
        duration: String(dur || "--:--"),
        url: "https://www.youtube.com/watch?v=" + String(e.id),
        thumb: "https://i.ytimg.com/vi/" + String(e.id) + "/mqdefault.jpg"
      });
    }
  } catch (err) {}
  return out;
}

function formatDuration(secs) {
  secs = Math.round(secs);
  if (!isFinite(secs) || secs < 0) return "--:--";
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  function p(n) { return (n < 10 ? "0" : "") + n; }
  if (h > 0) return h + ":" + p(m) + ":" + p(s);
  return m + ":" + p(s);
}

function isPlaylistUrl(url) {
  return url.indexOf("list=") !== -1;
}

function expandHome(path, home) {
  if (path && path.charAt(0) === "~") return (home || "") + path.slice(1);
  return path;
}

// Quality -> yt-dlp -f selector for VIDEO mode.
function videoFormatFor(quality) {
  switch (String(quality)) {
  case "best": return "bv*+ba/b";
  case "2160": return "bv*[height<=2160]+ba/b[height<=2160]/b[height<=2160]";
  case "1440": return "bv*[height<=1440]+ba/b[height<=1440]/b[height<=1440]";
  case "1080": return "bv*[height<=1080]+ba/b[height<=1080]/b[height<=1080]";
  case "720": return "bv*[height<=720]+ba/b[height<=720]/b[height<=720]";
  case "480": return "bv*[height<=480]+ba/b[height<=480]/b[height<=480]";
  case "360": return "bv*[height<=360]+ba/b[height<=360]/b[height<=360]";
  default: return "bv*[height<=1080]+ba/b[height<=1080]/b[height<=1080]";
  }
}

// Build a yt-dlp download command array (no shell quoting needed).
// opts: { url, mode: "video"|"audio", quality, audioFormat, videoFormat, outDir, playlist: "single"|"playlist", home }
function buildDownloadCommand(opts) {
  var cmd = ["yt-dlp", "--newline", "--progress", "--no-warnings"];
  var playlist = opts.playlist === "playlist";
  cmd.push(playlist ? "--yes-playlist" : "--no-playlist");

  var outDir = expandHome(opts.outDir || "~/Videos/Omayoutube", opts.home);
  var template = outDir + "/%(title)s [%(id)s].%(ext)s";
  if (playlist) template = outDir + "/%(playlist_title)s/%(playlist_index)s - %(title)s [%(id)s].%(ext)s";
  cmd.push("-o", template);

  if (opts.mode === "audio") {
    cmd.push("-x", "--audio-format", opts.audioFormat || "mp3");
    cmd.push("-f", "bestaudio/best");
  } else {
    cmd.push("-f", videoFormatFor(opts.quality || "1080"));
    var container = opts.videoFormat || "mp4";
    if (container !== "best") cmd.push("--remux-video", container);
  }
  cmd.push(opts.url);
  return cmd;
}

// Parse one yt-dlp progress line. Returns { pct } or null.
function parseProgressLine(line) {
  var m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(String(line));
  if (m) {
    var v = parseFloat(m[1]);
    if (isFinite(v)) return { pct: Math.max(0, Math.min(100, v)) };
  }
  return null;
}

// Shell-quote one argv for bash -c use.
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// Single-shell download script: ensures the dir, then execs yt-dlp with
// stderr merged to stdout so one SplitParser sees every progress line.
function buildDownloadScript(opts) {
  var parts = buildDownloadCommand(opts);
  var quoted = [];
  for (var i = 0; i < parts.length; ++i) quoted.push(shellQuote(parts[i]));
  var outDir = expandHome(opts.outDir || "~/Videos/Omayoutube", opts.home);
  return "mkdir -p " + shellQuote(outDir) + " && exec " + quoted.join(" ") + " 2>&1";
}

// ms -> m:ss for player position labels.
function fmtTime(ms) {
  var s = Math.floor((ms || 0) / 1000);
  if (!isFinite(s) || s < 0) s = 0;
  var m = Math.floor(s / 60);
  var r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

// Extract a YouTube video id from watch/shorts/share URLs.
function extractId(url) {
  var u = String(url || "");
  var m = /[?&]v=([A-Za-z0-9_-]{6,})/.exec(u);
  if (m) return m[1];
  m = /youtu\.be\/([A-Za-z0-9_-]{6,})/.exec(u);
  if (m) return m[1];
  m = /\/(shorts|live|embed)\/([A-Za-z0-9_-]{6,})/.exec(u);
  if (m) return m[2];
  return "";
}

function cacheDir(home) {
  return (home || "") + "/.cache/omayoutube-dl";
}

function cacheFileFor(id, home) {
  return cacheDir(home) + "/watch-" + (id || "video") + ".mp4";
}

// Cache script: download+merge to a local mp4 so the embedded player can
// play videos that have no progressive (single-file) stream.
// H.264 (avc1) is preferred: VAAPI hardware decoding is broken for AV1/VP9
// on some systems (black screen with sound), while H.264 decodes fine.
function buildCacheScript(url, file) {
  var dir = String(file).replace(/\/[^\/]*$/, "");
  return "mkdir -p " + shellQuote(dir) + " && exec 'yt-dlp' '--newline' '--progress' '--no-warnings'"
    + " '--no-playlist' '-f' 'bv*[vcodec^=avc1][height<=720]+ba/b[vcodec^=avc1][height<=720]/bv*[height<=720]+ba/b[height<=720]'"
    + " '--remux-video' 'mp4' '--force-overwrites' '-o' " + shellQuote(file)
    + " " + shellQuote(url) + " 2>&1";
}

// Delete downloaded files for one video id. Our template names files
// "<title> [<id>].<ext>", so match "*[<id>].*".
function buildDeleteScript(outDir, id, home) {
  if (!id) return "exit 0";
  var d = expandHome(outDir, home);
  return "rm -f " + shellQuote(d) + "/*" + shellQuote("[" + id + "]") + ".* 2>/dev/null; exit 0";
}

function searchSpec(query, count) {
  return "ytsearch" + (count || 10) + ":" + query;
}

function qualityOptions() {
  return [
    { value: "best", label: "Best available" },
    { value: "2160", label: "4K (2160p max)" },
    { value: "1440", label: "1440p max" },
    { value: "1080", label: "1080p max" },
    { value: "720", label: "720p max" },
    { value: "480", label: "480p max" },
    { value: "360", label: "360p (small)" }
  ];
}

function audioFormatOptions() {
  return ["mp3", "m4a", "opus", "flac", "wav"];
}

function videoContainerOptions() {
  return ["mp4", "mkv", "webm", "best"];
}

function maxResultsOptions() {
  return ["5", "10", "15"];
}
