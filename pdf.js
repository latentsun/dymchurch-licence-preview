const PARK_NAME = "Sam Sellers";
const TEMPLATE = "./assets/licence-2027.pdf";
const PARK_SIGNATURE = "./assets/park-signature.png";

const contactRows = [
  ["ownerName", "Full name", 583.3, 607.4],
  ["address", "Main residential address", 607.4, 631.5],
  ["postcode", "Postcode", 631.5, 655.6],
  ["email", "Email address", 655.6, 679.7],
  ["telephone", "Daytime telephone", 679.7, 703.8],
  ["mobile", "Mobile", 703.8, 727.9],
  ["nextOfKin", "Next of kin", 727.9, 752.0],
  ["nextOfKinPhone", "Next of kin phone", 752.0, 776.1],
];

const caravanRows = [
  ["carRegistration", "Car registration", 45.4, 69.4],
  ["financeProvider", "Finance provider", 69.4, 93.5],
  ["make", "Make", 132.1, 156.2],
  ["model", "Model name or type", 156.2, 180.3],
  ["dimensions", "Length and width", 180.3, 204.4],
  ["serial", "Serial number", 204.4, 228.5],
  ["manufactureYear", "Year of manufacture", 252.6, 276.7],
  ["pitch", "Current pitch", 276.7, 300.8],
  ["sleepingCapacity", "Maximum sleeping capacity", 324.9, 348.9],
];

const specificationBoxes = { EN1647: [256.3, 236.9], BS3632: [295.7, 236.9] };
const firstOwnerBoxes = { yes: [232.2, 309.2], no: [250.2, 309.2] };
const paymentBoxes = { full: [58.1, 671.2], instalments: [58.1, 704.4] };
const marketingBoxes = { email: [113.2, 399.1], phone: [147.5, 399.1], sms: [201.8, 399.1] };

async function assetBytes(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Could not load an agreement file. Refresh the page and try again.");
  return response.arrayBuffer();
}

function wrapText(text, width, measure) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/u)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && measure(line + character) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(text, width, height, preferredSize, measure) {
  for (let size = preferredSize; size >= 6; size -= 0.5) {
    const lines = wrapText(text, width, (line) => measure(line, size));
    if (lines.length * size * 1.2 <= height) return { lines, size };
  }
  return undefined;
}

async function putText(pdf, page, font, supported, color, value, box, label, options = {}) {
  if (!value) return;
  const text = String(value).normalize("NFC").trim().replace(/\s*\n\s*/gu, ", ");
  const { x, top, width, height } = box;
  const { size: preferredSize = 10, center = false } = options;
  const canEncode = [...text].every((character) => supported.has(character.codePointAt(0)));
  if (canEncode) {
    const measure = (line, size) => font.widthOfTextAtSize(line, size);
    const fitted = fitText(text, width, height, preferredSize, measure);
    if (!fitted) throw new Error(`The value for ${label} is too long to fit in the PDF. Edit it and try again.`);
    const { lines, size } = fitted;
    const lineHeight = size * 1.2;
    const firstBaseline = top + (height - lines.length * lineHeight) / 2 + size;
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: center ? x + (width - measure(line, size)) / 2 : x,
        y: page.getHeight() - firstBaseline - index * lineHeight,
        font, size, color,
      });
    });
    return;
  }

  // Keep names and addresses that the PDF's built-in font cannot encode.
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  const measure = (line, size) => {
    context.font = `${size}px sans-serif`;
    return context.measureText(line).width;
  };
  const fitted = fitText(text, width, height, preferredSize, measure);
  if (!fitted) throw new Error(`The value for ${label} is too long to fit in the PDF. Edit it and try again.`);
  const { lines, size } = fitted;
  const lineHeight = size * 1.2;
  const firstBaseline = (height - lines.length * lineHeight) / 2 + size;
  context.font = `${size}px sans-serif`;
  context.fillStyle = "#172b3d";
  context.textAlign = center ? "center" : "left";
  lines.forEach((line, index) => context.fillText(line, center ? width / 2 : 0, firstBaseline + index * lineHeight));
  const image = await pdf.embedPng(canvas.toDataURL("image/png"));
  page.drawImage(image, { x, y: page.getHeight() - top - height, width, height });
}

function stampImage(page, image, { x, top, width, height }) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  page.drawImage(image, {
    x, y: page.getHeight() - top - (height + drawnHeight) / 2,
    width: drawnWidth, height: drawnHeight,
  });
}

function tick(page, point, color) {
  if (!point) return;
  const [x, top] = point;
  const y = page.getHeight() - top;
  page.drawLine({ start: { x: x + 1.5, y: y - 4 }, end: { x: x + 3.4, y: y - 6.3 }, thickness: 0.9, color });
  page.drawLine({ start: { x: x + 3.4, y: y - 6.3 }, end: { x: x + 6.6, y: y - 2.3 }, thickness: 0.9, color });
}

export async function downloadAgreement({ details, initials, signature, date, consent }) {
  if (!globalThis.PDFLib) throw new Error("The PDF generator did not load. Refresh the page and try again.");
  const { PDFDocument, StandardFonts, rgb } = globalThis.PDFLib;
  const [templateBytes, parkBytes] = await Promise.all([assetBytes(TEMPLATE), assetBytes(PARK_SIGNATURE)]);
  const pdf = await PDFDocument.load(templateBytes);
  const pages = pdf.getPages();
  if (pages.length !== 14) throw new Error("The licence template has an unexpected number of pages.");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const supported = new Set(font.getCharacterSet());
  const ink = rgb(0.09, 0.17, 0.24);
  const previewInk = rgb(0.46, 0.33, 0.15);
  const write = (page, value, box, label, options) => putText(pdf, page, font, supported, ink, value, box, label, options);

  for (const [page, rows] of [[pages[1], contactRows], [pages[2], caravanRows]]) {
    for (const [key, label, top, bottom] of rows) {
      await write(page, details[key], { x: 225.8, top: top + 1, width: 309, height: bottom - top - 2 }, label);
    }
  }

  tick(pages[2], specificationBoxes[details.specification], ink);
  tick(pages[2], firstOwnerBoxes[details.firstOwner], ink);
  tick(pages[2], paymentBoxes[details.payment], ink);
  for (const preference of details.marketing) tick(pages[4], marketingBoxes[preference], ink);

  for (const [number, value] of initials) {
    await write(pages[number - 1], value, { x: 279, top: 797.5, width: 99.5, height: 23.5 }, "Initials", { size: 14, center: true });
  }

  const signaturePage = pages[12];
  const parkSignature = await pdf.embedPng(parkBytes);
  const ownerSignature = await pdf.embedPng(signature.png);
  stampImage(signaturePage, parkSignature, { x: 59.5, top: 330, width: 224, height: 36 });
  stampImage(signaturePage, ownerSignature, { x: 306, top: 330, width: 224, height: 36 });

  for (const [x, name] of [[59.5, PARK_NAME], [306, details.ownerName]]) {
    await write(signaturePage, name, { x, top: 391, width: 226, height: 13 }, "Printed name");
    await write(signaturePage, date, { x, top: 425, width: 226, height: 13 }, "Signature date");
  }

  const signingRecord = [
    ["Electronic signing record (local preview)", 516, 11],
    [consent, 537, 9],
    [`Confirmed email: ${details.email}`, 558, 9],
    [`Date: ${date} (UK) | Owner signature: ${signature.method}`, 579, 9],
  ];
  for (const [value, top, size] of signingRecord) {
    await write(signaturePage, value, { x: 51, top, width: 493, height: 20 }, "Electronic signing record", { size });
  }

  const watermark = "LOCAL PREVIEW - SAMPLE ONLY";
  for (const page of pages) {
    const size = 8;
    page.drawText(watermark, {
      x: (page.getWidth() - font.widthOfTextAtSize(watermark, size)) / 2,
      y: 6, font, size, color: previewInk,
    });
  }

  pdf.setTitle("Dymchurch Annual Licence Agreement 2027 - Local Preview");
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Dymchurch-Annual-Licence-2027-SAMPLE.pdf";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
