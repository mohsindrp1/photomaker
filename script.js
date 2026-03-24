/**
 * ============================================================
 *  PASSPORT PHOTO MAKER — script.js
 *  Handles: upload, cropping, background, A4 layout, download
 * ============================================================
 */

"use strict";

/* =============================================
   STATE — single source of truth
   ============================================= */
const state = {
  image: null,           // HTMLImageElement once loaded
  // Photo dimensions
  photoW_mm: 35,
  photoH_mm: 45,
  // DPI
  dpi: 300,
  // Background
  bgColor: "#ffffff",
  // Margins (mm)
  marginTop_mm: 10,
  marginLeft_mm: 10,
  marginRight_mm: 10,
  // Gap between photos (mm)
  gap_mm: 2,
  // Photo count ('auto' or integer)
  photoCount: "auto",
  // Border
  borderOn: false,
  borderThickness: 1,   // px on final canvas
  borderColor: "#000000",
  // Position / zoom
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,
};

/* =============================================
   A4 CONSTANTS (mm) — fixed physical size
   ============================================= */
const A4_W_MM = 210;
const A4_H_MM = 297;

/* Convert mm → px at current DPI */
const mmToPx = (mm, dpi = state.dpi) => Math.round((mm / 25.4) * dpi);

/* =============================================
   DOM REFS
   ============================================= */
const fileInput      = document.getElementById("fileInput");
const uploadLabel    = document.getElementById("uploadLabel");
const uploadPreview  = document.getElementById("uploadPreview");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");

const singleCanvas   = document.getElementById("singleCanvas");
const a4Canvas       = document.getElementById("a4Canvas");
const printCanvas    = document.getElementById("printCanvas");

const noPhotoMsg     = document.getElementById("noPhotoMsg");
const noPhotoMsgA4   = document.getElementById("noPhotoMsgA4");
const photoCountBadge = document.getElementById("photoCountBadge");

const btnDownload    = document.getElementById("btnDownload");
const btnPrint       = document.getElementById("btnPrint");
const btnResetPos    = document.getElementById("btnResetPos");

/* =============================================
   HELPERS
   ============================================= */
function setSegActive(groupId, val) {
  document.querySelectorAll(`#${groupId} .seg-btn`).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val === String(val));
  });
}

function showCanvases() {
  singleCanvas.style.display  = "block";
  a4Canvas.style.display      = "block";
  noPhotoMsg.style.display    = "none";
  noPhotoMsgA4.style.display  = "none";
  btnDownload.disabled        = false;
  btnPrint.disabled           = false;
}

/* =============================================
   IMAGE UPLOAD
   ============================================= */
fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) loadFile(file);
});

// Drag & drop
uploadLabel.addEventListener("dragover", e => {
  e.preventDefault();
  uploadLabel.classList.add("drag-over");
});
uploadLabel.addEventListener("dragleave", () => uploadLabel.classList.remove("drag-over"));
uploadLabel.addEventListener("drop", e => {
  e.preventDefault();
  uploadLabel.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) loadFile(file);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      uploadPreview.src = ev.target.result;
      uploadPreview.classList.remove("hidden");
      uploadPlaceholder.classList.add("hidden");
      // Reset offsets for new image
      state.offsetX = 0;
      state.offsetY = 0;
      state.zoom    = 1.0;
      syncPosSliders();
      renderAll();
      showCanvases();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* =============================================
   PHOTO SIZE SELECTOR
   ============================================= */
const presets = {
  india_passport: { w: 35, h: 45 },
  visa_2x2:       { w: 50.8, h: 50.8 },
};

document.querySelectorAll('input[name="photoSize"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const val = radio.value;
    const customRow = document.getElementById("customSizeRow");
    if (val === "custom") {
      customRow.classList.remove("hidden");
      readCustomSize();
    } else {
      customRow.classList.add("hidden");
      state.photoW_mm = presets[val].w;
      state.photoH_mm = presets[val].h;
      renderAll();
    }
  });
});

["customW", "customH"].forEach(id => {
  document.getElementById(id).addEventListener("input", readCustomSize);
});

function readCustomSize() {
  const w = parseFloat(document.getElementById("customW").value) || 35;
  const h = parseFloat(document.getElementById("customH").value) || 45;
  state.photoW_mm = w;
  state.photoH_mm = h;
  renderAll();
}

/* =============================================
   DPI SELECTOR
   ============================================= */
document.querySelectorAll("#dpiGroup .seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.dpi = parseInt(btn.dataset.val);
    setSegActive("dpiGroup", state.dpi);
    renderAll();
  });
});

/* =============================================
   BACKGROUND COLOR
   ============================================= */
document.querySelectorAll('input[name="bgColor"]').forEach(radio => {
  radio.addEventListener("change", () => {
    state.bgColor = radio.value;
    renderAll();
  });
});

/* =============================================
   MARGINS
   ============================================= */
["marginTop", "marginLeft", "marginRight"].forEach(id => {
  document.getElementById(id).addEventListener("input", e => {
    const key = id + "_mm";
    state[key] = parseFloat(e.target.value) || 0;
    renderAll();
  });
});

/* =============================================
   GAP SLIDER
   ============================================= */
const gapSlider = document.getElementById("gapSlider");
const gapVal    = document.getElementById("gapVal");
gapSlider.addEventListener("input", () => {
  state.gap_mm = parseFloat(gapSlider.value);
  gapVal.textContent = gapSlider.value + " mm";
  renderAll();
});

/* =============================================
   PHOTO COUNT
   ============================================= */
document.querySelectorAll("#countGroup .seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const raw = btn.dataset.val;
    state.photoCount = raw === "auto" ? "auto" : parseInt(raw);
    setSegActive("countGroup", raw);
    renderAll();
  });
});

/* =============================================
   BORDER TOGGLE
   ============================================= */
const borderToggle    = document.getElementById("borderToggle");
const borderControls  = document.getElementById("borderControls");
const borderLabel     = document.getElementById("borderLabel");
const borderThickness = document.getElementById("borderThickness");
const borderThickVal  = document.getElementById("borderThickVal");
const borderColorIn   = document.getElementById("borderColor");

borderToggle.addEventListener("change", () => {
  state.borderOn = borderToggle.checked;
  borderLabel.textContent = state.borderOn ? "On" : "Off";
  borderControls.classList.toggle("hidden", !state.borderOn);
  renderAll();
});

borderThickness.addEventListener("input", () => {
  state.borderThickness = parseInt(borderThickness.value);
  borderThickVal.textContent = borderThickness.value + "px";
  renderAll();
});

borderColorIn.addEventListener("input", () => {
  state.borderColor = borderColorIn.value;
  renderAll();
});

/* =============================================
   POSITION / ZOOM
   ============================================= */
const zoomSlider = document.getElementById("zoomSlider");
const xSlider    = document.getElementById("xSlider");
const ySlider    = document.getElementById("ySlider");
const zoomVal    = document.getElementById("zoomVal");
const xVal       = document.getElementById("xVal");
const yVal       = document.getElementById("yVal");

zoomSlider.addEventListener("input", () => {
  state.zoom = parseFloat(zoomSlider.value) / 100;
  zoomVal.textContent = zoomSlider.value + "%";
  renderAll();
});
xSlider.addEventListener("input", () => {
  state.offsetX = parseInt(xSlider.value);
  xVal.textContent = xSlider.value;
  renderAll();
});
ySlider.addEventListener("input", () => {
  state.offsetY = parseInt(ySlider.value);
  yVal.textContent = ySlider.value;
  renderAll();
});

btnResetPos.addEventListener("click", () => {
  state.zoom = 1; state.offsetX = 0; state.offsetY = 0;
  syncPosSliders();
  renderAll();
});

function syncPosSliders() {
  zoomSlider.value = Math.round(state.zoom * 100);
  xSlider.value    = state.offsetX;
  ySlider.value    = state.offsetY;
  zoomVal.textContent = zoomSlider.value + "%";
  xVal.textContent    = xSlider.value;
  yVal.textContent    = ySlider.value;
}

/* =============================================
   DRAG TO ADJUST POSITION ON SINGLE CANVAS
   ============================================= */
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragStartOX = 0, dragStartOY = 0;

singleCanvas.style.cursor = "grab";

singleCanvas.addEventListener("mousedown", e => {
  dragging     = true;
  dragStartX   = e.clientX;
  dragStartY   = e.clientY;
  dragStartOX  = state.offsetX;
  dragStartOY  = state.offsetY;
  singleCanvas.style.cursor = "grabbing";
});
window.addEventListener("mousemove", e => {
  if (!dragging) return;
  const scale = singleCanvas.width / singleCanvas.offsetWidth; // CSS vs canvas px
  state.offsetX = dragStartOX + (e.clientX - dragStartX) * scale;
  state.offsetY = dragStartOY + (e.clientY - dragStartY) * scale;
  // Clamp to reasonable range
  state.offsetX = Math.max(-500, Math.min(500, state.offsetX));
  state.offsetY = Math.max(-500, Math.min(500, state.offsetY));
  syncPosSliders();
  renderAll();
});
window.addEventListener("mouseup", () => {
  dragging = false;
  singleCanvas.style.cursor = "grab";
});

/* =============================================
   CORE RENDER FUNCTIONS
   ============================================= */

/**
 * Draw one passport photo onto any canvas context.
 * destX, destY: top-left corner in canvas pixels
 * photoW, photoH: size in canvas pixels
 */
function drawPhoto(ctx, destX, destY, photoW, photoH) {
  // 1. Background
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(destX, destY, photoW, photoH);

  if (state.image) {
    // 2. Compute image placement with zoom & offset
    const img = state.image;
    const imgAR = img.width / img.height;
    const photoAR = photoW / photoH;

    // Base scale: cover the photo area
    let baseW, baseH;
    if (imgAR > photoAR) {
      // image wider — fit by height
      baseH = photoH;
      baseW = photoH * imgAR;
    } else {
      // image taller — fit by width
      baseW = photoW;
      baseH = photoW / imgAR;
    }

    // Apply user zoom
    const drawW = baseW * state.zoom;
    const drawH = baseH * state.zoom;

    // Center + user offset
    const drawX = destX + (photoW - drawW) / 2 + state.offsetX;
    const drawY = destY + (photoH - drawH) / 2 + state.offsetY;

    // Clip to photo area
    ctx.save();
    ctx.beginPath();
    ctx.rect(destX, destY, photoW, photoH);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // 3. Border
  if (state.borderOn) {
    ctx.strokeStyle = state.borderColor;
    ctx.lineWidth   = state.borderThickness;
    ctx.strokeRect(
      destX + state.borderThickness / 2,
      destY + state.borderThickness / 2,
      photoW - state.borderThickness,
      photoH - state.borderThickness
    );
  }
}

/* ---- Render Single Preview ---- */
function renderSingle() {
  if (!state.image) return;
  const photoW = mmToPx(state.photoW_mm);
  const photoH = mmToPx(state.photoH_mm);

  // Preview scale: cap at 300px wide for the panel
  const maxDisplay = 300;
  const scale = Math.min(1, maxDisplay / photoW);

  singleCanvas.width  = Math.round(photoW * scale);
  singleCanvas.height = Math.round(photoH * scale);

  const ctx = singleCanvas.getContext("2d");
  ctx.save();
  ctx.scale(scale, scale);
  drawPhoto(ctx, 0, 0, photoW, photoH);
  ctx.restore();
}

/* ---- Render A4 Layout ---- */
function renderA4(targetCanvas, targetDPI = state.dpi) {
  if (!state.image) return;

  // Pixel sizes at target DPI
  const a4W  = mmToPx(A4_W_MM, targetDPI);
  const a4H  = mmToPx(A4_H_MM, targetDPI);
  const photoW = mmToPx(state.photoW_mm, targetDPI);
  const photoH = mmToPx(state.photoH_mm, targetDPI);
  const gap    = mmToPx(state.gap_mm, targetDPI);
  const mTop   = mmToPx(state.marginTop_mm,   targetDPI);
  const mLeft  = mmToPx(state.marginLeft_mm,  targetDPI);
  const mRight = mmToPx(state.marginRight_mm, targetDPI);

  // Printable width / height (no forced bottom margin)
  const printW = a4W - mLeft - mRight;
  const printH = a4H - mTop;           // bottom is leftover

  // How many photos fit per row / col?
  const photosPerRow = Math.max(1, Math.floor((printW + gap) / (photoW + gap)));
  const photosPerCol = Math.max(1, Math.floor((printH + gap) / (photoH + gap)));
  const maxAuto      = photosPerRow * photosPerCol;

  // Requested count
  let count;
  if (state.photoCount === "auto") {
    count = maxAuto;
  } else {
    count = Math.min(state.photoCount, maxAuto);
  }

  // Update badge
  photoCountBadge.textContent = `${count} photos`;

  // Set canvas size
  targetCanvas.width  = a4W;
  targetCanvas.height = a4H;

  const ctx = targetCanvas.getContext("2d");

  // White A4 background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, a4W, a4H);

  // Place photos: top-left → right → next row (NO vertical centering)
  let placed = 0;
  outer:
  for (let row = 0; row < photosPerCol; row++) {
    for (let col = 0; col < photosPerRow; col++) {
      if (placed >= count) break outer;
      const x = mLeft + col * (photoW + gap);
      const y = mTop  + row * (photoH + gap);
      drawPhoto(ctx, x, y, photoW, photoH);
      placed++;
    }
  }

  // Light cutting guide lines (optional thin grey lines)
  drawCutLines(ctx, a4W, a4H, mLeft, mTop, photoW, photoH, gap, photosPerRow, photosPerCol, count);
}

/**
 * Draw subtle cut-lines around photos to guide scissors.
 */
function drawCutLines(ctx, a4W, a4H, mLeft, mTop, photoW, photoH, gap, cols, rows, count) {
  ctx.save();
  ctx.strokeStyle = "rgba(180,180,180,0.5)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);

  let placed = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (placed >= count) break;
      const x = mLeft + col * (photoW + gap);
      const y = mTop  + row * (photoH + gap);
      ctx.strokeRect(x, y, photoW, photoH);
      placed++;
    }
  }
  ctx.restore();
}

/* ---- Master render ---- */
function renderAll() {
  renderSingle();

  // A4 preview — scale down for display
  const tempCanvas = document.createElement("canvas");
  renderA4(tempCanvas, state.dpi);

  // Scale to fit preview area (max 780px wide)
  const maxPreviewW = 780;
  const scale = Math.min(1, maxPreviewW / tempCanvas.width);
  a4Canvas.width  = Math.round(tempCanvas.width  * scale);
  a4Canvas.height = Math.round(tempCanvas.height * scale);

  const ctx = a4Canvas.getContext("2d");
  ctx.drawImage(tempCanvas, 0, 0, a4Canvas.width, a4Canvas.height);
}

/* =============================================
   DOWNLOAD — full resolution PNG
   ============================================= */
btnDownload.addEventListener("click", () => {
  if (!state.image) return;
  const fullCanvas = document.createElement("canvas");
  renderA4(fullCanvas, state.dpi);     // full resolution at selected DPI

  const link = document.createElement("a");
  link.download = `passport_photos_${state.dpi}dpi.png`;
  link.href = fullCanvas.toDataURL("image/png");
  link.click();
});

/* =============================================
   PRINT — open print dialog with correct scaling
   ============================================= */
btnPrint.addEventListener("click", () => {
  if (!state.image) return;

  // Render at full DPI
  const fullCanvas = document.createElement("canvas");
  renderA4(fullCanvas, state.dpi);

  // Open a new window with the image sized to A4
  const dataUrl = fullCanvas.toDataURL("image/png");
  const printWin = window.open("", "_blank");
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Passport Photos</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#fff; }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        img {
          display: block;
          width: 210mm;
          height: 297mm;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <img src="${dataUrl}" />
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 800);
        };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
});

/* =============================================
   INIT
   ============================================= */
// Make sure initial seg-button states are correct
setSegActive("dpiGroup",   "300");
setSegActive("countGroup", "auto");