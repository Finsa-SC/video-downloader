/* =========================================================
   Video Downloader - script.js
   ========================================================= */

/* ---------- API config (match your routes) ---------- */
const CONFIG = {
  baseUrl: location.port === "8000" ? "/api" : "http://localhost:8000/api",

  // GET {baseUrl}/info?url=...
  // -> { title, thumbnail, duration, resolutions: [1080, 720, ...] }
  infoPath: "/info",

  // POST {baseUrl}/download
  // body JSON: { url, mode: "video"|"video_only"|"audio_only", resolution?: 720 }
  // -> file (FileResponse)
  downloadPath: "/download",
};

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);

const urlForm = $("url-form");
const urlInput = $("url-input");
const checkBtn = $("check-btn");
const infoError = $("info-error");

const resultBox = $("result");
const thumbEl = $("video-thumb");
const titleEl = $("video-title");
const durationEl = $("video-duration");

const resolutionField = $("resolution-field");
const resolutionList = $("resolution-list");
const downloadBtn = $("download-btn");
const downloadStatus = $("download-status");

const state = {
  url: "",
  info: null,
};

/* ---------- Helper ---------- */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function setLoading(button, loading, label) {
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  button.querySelector(".btn-label").textContent = label;
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.hidden = !text;
  el.classList.toggle("message-error", type === "error");
  el.classList.toggle("message-success", type === "success");
}

async function readError(response) {
  try {
    const data = await response.json();
    const detail = data.detail ?? data.message;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
  } catch (_) { /* bukan JSON */ }
  return `The server returned an error (${response.status}).`;
}

function networkMessage() {
  return "Could not reach the server. Make sure the API is running on localhost:8000 and CORS is enabled.";
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function getResolution() {
  const checked = document.querySelector('input[name="resolution"]:checked');
  return checked ? checked.value : null;
}

function filenameFromHeader(header) {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch (_) { /* lanjut */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/* ---------- Fetch video info ---------- */
async function fetchInfo(event) {
  event.preventDefault();

  const url = urlInput.value.trim();
  showMessage(infoError, "");
  showMessage(downloadStatus, "");

  if (!url) {
    showMessage(infoError, "Enter a video link first.", "error");
    urlInput.focus();
    return;
  }

  setLoading(checkBtn, true, "Checking...");
  resultBox.hidden = true;

  try {
    let response;
    try {
      const params = new URLSearchParams({ url });
      response = await fetch(`${CONFIG.baseUrl}${CONFIG.infoPath}?${params}`);
    } catch (error) {
      console.error("Fetch /info gagal:", error);
      showMessage(infoError, networkMessage(), "error");
      return;
    }

    if (!response.ok) {
      showMessage(infoError, await readError(response), "error");
      return;
    }

    const info = await response.json();
    state.url = url;
    state.info = info;
    renderInfo(info);
  } catch (error) {
    console.error(error);
    showMessage(infoError, `Page error: ${error.message}`, "error");
  } finally {
    setLoading(checkBtn, false, "Check video");
  }
}

/* ---------- Show info + download options ---------- */
function renderInfo(info) {
  thumbEl.src = info.thumbnail || "";
  thumbEl.hidden = !info.thumbnail;
  titleEl.textContent = info.title || "Untitled";
  durationEl.textContent = info.duration ? `Duration ${formatDuration(info.duration)}` : "";

  renderResolutions(info.resolutions || []);
  updateModeUI();

  resultBox.hidden = false;
  resultBox.style.animation = "none";
  void resultBox.offsetWidth; // restart animation
  resultBox.style.animation = "";
  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResolutions(list) {
  resolutionList.replaceChildren();

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "message";
    empty.textContent = "No resolutions available for this video.";
    resolutionList.append(empty);
    return;
  }

  list.forEach((height, index) => {
    const label = document.createElement("label");
    label.className = "res-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "resolution";
    input.value = height;
    input.checked = index === 0; // default: highest quality

    const chip = document.createElement("span");
    chip.className = "res-chip";
    chip.textContent = `${height}p`;

    label.append(input, chip);
    resolutionList.append(label);
  });
}

/* Quality is hidden in audio_only mode */
function updateModeUI() {
  resolutionField.hidden = getMode() === "audio_only";
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", updateModeUI);
});

/* ---------- Download ---------- */
async function startDownload() {
  const mode = getMode();
  const resolution = getResolution();

  if (mode !== "audio_only" && !resolution) {
    showMessage(downloadStatus, "Choose a video quality first.", "error");
    return;
  }

  const payload = { url: state.url, mode };
  if (mode !== "audio_only") payload.resolution = Number(resolution);

  setLoading(downloadBtn, true, "Preparing file...");
  showMessage(downloadStatus, "The server is downloading the video. This may take a while, so keep this page open.");

  try {
    let response;
    try {
      response = await fetch(`${CONFIG.baseUrl}${CONFIG.downloadPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Fetch /download gagal:", error);
      showMessage(downloadStatus, networkMessage(), "error");
      return;
    }

    if (!response.ok) {
      showMessage(downloadStatus, await readError(response), "error");
      return;
    }

    const blob = await response.blob();
    const fallbackExt = mode === "audio_only" ? "mp3" : "mp4";
    const filename =
      filenameFromHeader(response.headers.get("Content-Disposition")) ||
      `${(state.info.title || "video").slice(0, 80)}.${fallbackExt}`;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

    showMessage(downloadStatus, "Done. The file has been saved to your device.", "success");
  } catch (error) {
    console.error(error);
    showMessage(downloadStatus, `Page error: ${error.message}`, "error");
  } finally {
    setLoading(downloadBtn, false, "Download");
  }
}

/* ---------- Init ---------- */
urlForm.addEventListener("submit", fetchInfo);
downloadBtn.addEventListener("click", startDownload);