/* =========================================================
   FinSky Downloader - script.js
   ========================================================= */

/* ---------- API config (match your routes) ---------- */
const CONFIG = {
  baseUrl: location.port === "8000" ? "/api" : "http://localhost:8000/api",

  // GET {baseUrl}/info?url=...
  //   video -> { type: "video", details: { title, thumbnail, duration, resolutions } }
  //   image -> { type: "image", image_url, content_type }
  infoPath: "/info",

  // POST {baseUrl}/download
  //   body: { url, mode: "original"|"video"|"video_only"|"audio_only",
  //           resolution?, remove_bg?, enhance? }
  //   -> file (FileResponse)
  downloadPath: "/download",
};

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);

const urlForm = $("url-form");
const urlInput = $("url-input");
const checkBtn = $("check-btn");
const infoError = $("info-error");

const resultBox = $("result");
const videoView = $("video-view");
const imageView = $("image-view");

// video
const thumbEl = $("video-thumb");
const titleEl = $("video-title");
const durationEl = $("video-duration");
const resolutionField = $("resolution-field");
const resolutionList = $("resolution-list");
const downloadBtn = $("download-btn");
const downloadStatus = $("download-status");

// image
const imagePreview = $("image-preview");
const imageType = $("image-type");
const processBtn = $("process-btn");
const originalBtn = $("original-btn");
const imageStatus = $("image-status");
const processedCard = $("processed-card");
const processedPreview = $("processed-preview");
const processedNote = $("processed-note");
const processedDownload = $("processed-download");
const processedDiscard = $("processed-discard");
const processedStatus = $("processed-status");

const state = {
  url: "",
  previewUrl: null,   // object URL for a preview loaded through the server
  processed: null,    // { blob, filename, url }
};

/* ---------- Helpers ---------- */
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
  } catch (_) { /* not JSON */ }
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
    try { return decodeURIComponent(star[1]); } catch (_) { /* continue */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

function revokeUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

/* Error that keeps the HTTP status, so callers can word the message */
function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/* ---------- Check link ---------- */
async function fetchInfo(event) {
  event.preventDefault();

  const url = urlInput.value.trim();
  showMessage(infoError, "");

  if (!url) {
    showMessage(infoError, "Enter a link first.", "error");
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
      console.error("Fetch /info failed:", error);
      showMessage(infoError, networkMessage(), "error");
      return;
    }

    if (!response.ok) {
      showMessage(infoError, await readError(response), "error");
      return;
    }

    const data = await response.json();
    state.url = url;

    if (data.type === "image") {
      renderImage(data);
    } else {
      renderVideo(data.details ?? data);
    }
  } catch (error) {
    console.error(error);
    showMessage(infoError, `Page error: ${error.message}`, "error");
  } finally {
    setLoading(checkBtn, false, "Check link");
  }
}

function revealResult(view) {
  videoView.hidden = view !== "video";
  imageView.hidden = view !== "image";

  resultBox.hidden = false;
  resultBox.style.animation = "none";
  void resultBox.offsetWidth; // restart animation
  resultBox.style.animation = "";
  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================================================
   VIDEO
   ========================================================= */
function renderVideo(info) {
  showMessage(downloadStatus, "");

  thumbEl.src = info.thumbnail || "";
  thumbEl.hidden = !info.thumbnail;
  titleEl.textContent = info.title || "Untitled";
  durationEl.textContent = info.duration ? `Duration ${formatDuration(info.duration)}` : "";

  renderResolutions(info.resolutions || []);
  updateModeUI();
  revealResult("video");
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
    const { blob, filename } = await postDownload(payload, mode === "audio_only" ? "mp3" : "mp4");
    saveBlob(blob, filename);
    showMessage(downloadStatus, "Done. The file has been saved to your device.", "success");
  } catch (error) {
    console.error(error);
    showMessage(downloadStatus, error.message, "error");
  } finally {
    setLoading(downloadBtn, false, "Download");
  }
}

/* One place that talks to POST /download (video and image) */
async function postDownload(payload, fallbackExt) {
  let response;
  try {
    response = await fetch(`${CONFIG.baseUrl}${CONFIG.downloadPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Fetch /download failed:", error);
    throw apiError(networkMessage(), 0);
  }

  if (!response.ok) {
    throw apiError(await readError(response), response.status);
  }

  const blob = await response.blob();
  const filename =
    filenameFromHeader(response.headers.get("Content-Disposition")) ||
    `download.${fallbackExt}`;

  return { blob, filename };
}

/* =========================================================
   IMAGE
   ========================================================= */
function describeImageType(contentType) {
  const match = /^image\/([\w.+-]+)/i.exec(contentType || "");
  return match ? `${match[1].toUpperCase()} image` : "Image";
}

function selectedEdits() {
  return {
    removeBg: document.querySelector('input[name="edit"][value="remove_bg"]').checked,
    enhance: document.querySelector('input[name="edit"][value="enhance"]').checked,
  };
}

/* "Process image" is only enabled when at least one edit is selected */
function updateProcessState() {
  const { removeBg, enhance } = selectedEdits();
  processBtn.disabled = !(removeBg || enhance);
}

document.querySelectorAll('input[name="edit"]').forEach((box) => {
  box.addEventListener("change", updateProcessState);
});

function discardProcessed() {
  if (state.processed) revokeUrl(state.processed.url);
  state.processed = null;
  processedCard.hidden = true;
  processedPreview.removeAttribute("src");
  showMessage(processedStatus, "");
}

function resetImageView() {
  revokeUrl(state.previewUrl);
  state.previewUrl = null;
  discardProcessed();

  imagePreview.onerror = null;
  imagePreview.removeAttribute("src");
  document.querySelectorAll('input[name="edit"]').forEach((box) => { box.checked = false; });
  updateProcessState();
  showMessage(imageStatus, "");
}

function renderImage(data) {
  resetImageView();

  imageType.textContent = describeImageType(data.content_type);

  // Some sites block hotlinking. If the direct link fails,
  // load the preview through our own server instead.
  imagePreview.onerror = loadPreviewFromServer;
  imagePreview.src = data.image_url || state.url;

  revealResult("image");
}

async function loadPreviewFromServer() {
  imagePreview.onerror = null;
  try {
    const { blob } = await postDownload(
      { url: state.url, mode: "original", remove_bg: false, enhance: false },
      "img"
    );
    state.previewUrl = URL.createObjectURL(blob);
    imagePreview.src = state.previewUrl;
  } catch (error) {
    console.error(error);
    showMessage(imageStatus, "Could not load a preview, but you can still download the image.", "error");
  }
}

/* Process with the selected edits, then show the result */
async function processImage() {
  const { removeBg, enhance } = selectedEdits();
  if (!removeBg && !enhance) return;

  setLoading(processBtn, true, "Processing...");
  originalBtn.disabled = true;
  showMessage(imageStatus, "Processing your image. This can take a moment.");

  try {
    const { blob, filename } = await postDownload(
      { url: state.url, mode: "original", remove_bg: removeBg, enhance },
      "png"
    );

    discardProcessed();
    state.processed = { blob, filename, url: URL.createObjectURL(blob) };
    processedPreview.src = state.processed.url;
    processedNote.textContent =
      "Applied: " + [removeBg && "Remove background", enhance && "Enhance quality"].filter(Boolean).join(" + ");

    showMessage(imageStatus, "");
    processedCard.hidden = false;
    processedCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    const message = error.status === 500
      ? "Processing failed on the server. Try again, or download the original."
      : error.message;
    showMessage(imageStatus, message, "error");
  } finally {
    setLoading(processBtn, false, "Process image");
    originalBtn.disabled = false;
    updateProcessState();
  }
}

async function downloadOriginal() {
  setLoading(originalBtn, true, "Downloading...");
  processBtn.disabled = true;
  showMessage(imageStatus, "");

  try {
    const { blob, filename } = await postDownload(
      { url: state.url, mode: "original", remove_bg: false, enhance: false },
      "jpg"
    );
    saveBlob(blob, filename);
    showMessage(imageStatus, "Done. The original image has been saved to your device.", "success");
  } catch (error) {
    console.error(error);
    showMessage(imageStatus, error.message, "error");
  } finally {
    setLoading(originalBtn, false, "Download original");
    updateProcessState();
  }
}

function downloadProcessed() {
  if (!state.processed) return;
  saveBlob(state.processed.blob, state.processed.filename);
  showMessage(processedStatus, "Done. The image has been saved to your device.", "success");
}

/* ---------- Init ---------- */
urlForm.addEventListener("submit", fetchInfo);
downloadBtn.addEventListener("click", startDownload);
processBtn.addEventListener("click", processImage);
originalBtn.addEventListener("click", downloadOriginal);
processedDownload.addEventListener("click", downloadProcessed);
processedDiscard.addEventListener("click", discardProcessed);