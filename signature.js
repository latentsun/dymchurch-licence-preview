export function createSignatureBox(onSave) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId("signature-dialog");
  const pad = byId("signature-pad");
  const pen = pad.getContext("2d", { willReadFrequently: true });
  const text = byId("signature-text");
  const typedPreview = byId("typed-preview");
  const error = byId("signature-error");
  const save = byId("save-signature");
  const ink = "#172b3d";
  let mode = "draw";
  let pointer;
  let drawn = false;

  function selectMode(nextMode) {
    mode = nextMode;
    const isDraw = mode === "draw";
    byId("draw-signature").hidden = !isDraw;
    byId("type-signature").hidden = isDraw;
    byId("choose-draw").setAttribute("aria-pressed", isDraw);
    byId("choose-type").setAttribute("aria-pressed", !isDraw);
    error.textContent = "";
  }

  function point(event) {
    const rect = pad.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * pad.width / rect.width,
      y: (event.clientY - rect.top) * pad.height / rect.height,
    };
  }

  function stroke(start, end) {
    pen.strokeStyle = ink;
    pen.lineWidth = 5;
    pen.lineCap = "round";
    pen.beginPath();
    pen.moveTo(start.x, start.y);
    pen.lineTo(end.x, end.y);
    pen.stroke();
  }

  function clearDrawing() {
    pen.clearRect(0, 0, pad.width, pad.height);
    drawn = false;
    error.textContent = "";
  }

  function cropDrawing() {
    const full = pen.getImageData(0, 0, pad.width, pad.height);
    const { data, width, height } = full;
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (left > right || top > bottom) return undefined;
    const cropped = document.createElement("canvas");
    cropped.width = right - left + 13;
    cropped.height = bottom - top + 13;
    cropped.getContext("2d").putImageData(full, 6 - left, 6 - top);
    return { method: "Drawn", png: cropped.toDataURL("image/png"), drawing: full };
  }

  function updateTypedPreview() {
    typedPreview.textContent = text.value.trim();
    error.textContent = "";
  }

  async function captureTypedSignature(name) {
    await document.fonts.load('112px "Licence Signature"', name);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const font = '112px "Licence Signature", cursive';
    context.font = font;
    const metrics = context.measureText(name);
    const inset = 16;
    canvas.width = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + inset * 2);
    canvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + inset * 2);
    context.font = font;
    context.fillStyle = ink;
    context.fillText(name, inset + metrics.actualBoundingBoxLeft, inset + metrics.actualBoundingBoxAscent);
    return { method: "Typed", png: canvas.toDataURL("image/png"), name };
  }

  pad.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    pad.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, ...point(event) };
    error.textContent = "";
  });
  pad.addEventListener("pointermove", (event) => {
    if (pointer?.id !== event.pointerId) return;
    const end = point(event);
    if (Math.hypot(end.x - pointer.x, end.y - pointer.y) < 1) return;
    stroke(pointer, end);
    pointer = { id: event.pointerId, ...end };
    drawn = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    pad.addEventListener(type, (event) => {
      if (pointer?.id === event.pointerId) pointer = undefined;
    });
  }

  byId("choose-draw").addEventListener("click", () => selectMode("draw"));
  byId("choose-type").addEventListener("click", () => {
    selectMode("type");
    text.focus();
  });
  byId("clear-signature").addEventListener("click", clearDrawing);
  for (const id of ["close-signature", "cancel-signature"]) {
    byId(id).addEventListener("click", () => dialog.close());
  }
  text.addEventListener("input", updateTypedPreview);
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter") save.click();
  });
  save.addEventListener("click", async () => {
    if (mode === "draw" && !drawn) {
      error.textContent = "Draw your signature in the box, or choose Type.";
      return;
    }
    const name = text.value.trim();
    if (mode === "type" && !/[\p{L}\p{N}]/u.test(name)) {
      error.textContent = "Type your name to create a signature.";
      text.focus();
      return;
    }
    save.disabled = true;
    try {
      const signature = mode === "draw" ? cropDrawing() : await captureTypedSignature(name);
      if (!signature) throw new Error("Blank drawing");
      if (!dialog.open) return;
      onSave(signature);
      dialog.close();
    } catch {
      error.textContent = "Could not save this signature. Please try again.";
    } finally {
      save.disabled = false;
    }
  });

  return {
    open(ownerName, existing) {
      clearDrawing();
      if (existing?.drawing) {
        pen.putImageData(existing.drawing, 0, 0);
        drawn = true;
      }
      text.value = existing?.name || ownerName;
      updateTypedPreview();
      selectMode(existing?.method === "Typed" ? "type" : "draw");
      dialog.showModal();
      if (mode === "type") text.focus();
    },
  };
}
