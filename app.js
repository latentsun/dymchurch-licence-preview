import { downloadAgreement } from "./pdf.js";
import { createSignatureBox } from "./signature.js";

const PAGE_COUNT = 14;
const INITIAL_PAGE_COUNT = PAGE_COUNT - 1;
const byId = (id) => document.getElementById(id);

const detailsForm = byId("details-form");
const stepButtons = [...document.querySelectorAll("[data-step]")];
const panels = [...document.querySelectorAll("[data-panel]")];
const initialForm = byId("initial-form");
const initialsField = byId("initials");
const pagePicker = byId("page-select");
const pageViewport = byId("page-viewport");
const signatureButton = byId("open-signature");
const consent = byId("digital-consent");
const exportStatus = byId("export-status");
const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "numeric",
});

const pageInitials = new Map();
let currentStep = 0;
let currentPage = 1;
let ownerDetails;
let signature;
let submittedAt;
let pageTextRequest;

const signatureBox = createSignatureBox((savedSignature) => {
  signature = savedSignature;
  resetConsent();
  renderSignature();
});

for (let page = 1; page <= PAGE_COUNT; page += 1) {
  pagePicker.add(new Option(String(page), String(page)));
}

function resetConsent() {
  consent.checked = false;
  submittedAt = undefined;
  exportStatus.textContent = "";
}

function renderSignature() {
  byId("signature-button-label").hidden = Boolean(signature);
  const image = byId("owner-signature-image");
  image.hidden = !signature;
  if (signature) {
    image.src = signature.png;
  } else {
    image.removeAttribute("src");
  }
  signatureButton.setAttribute("aria-label", signature ? "Edit your signature" : "Add your signature");
}

function updateNavigation() {
  stepButtons[1].disabled = !ownerDetails;
  stepButtons[2].disabled = pageInitials.size !== INITIAL_PAGE_COUNT;
}

function goToStep(step) {
  if (step === 2 && pageInitials.size !== INITIAL_PAGE_COUNT) return;
  currentStep = step;
  panels.forEach((panel, index) => { panel.hidden = index !== step; });
  stepButtons.forEach((button, index) => {
    if (index === step) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  updateNavigation();
  if (step === 1) showPage(currentPage);
  if (step === 2) showConfirmation();
  panels[step].querySelector("h2").focus({ preventScroll: true });
  panels[step].scrollIntoView({ block: "start" });
}

function suggestedInitials() {
  return ownerDetails.ownerName
    .split(/\s+/u)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] || "")
    .join("")
    .toLocaleUpperCase("en-GB")
    .slice(0, 8);
}

async function showTranscript() {
  if (!byId("page-transcript").open) return;
  const requestedPage = currentPage;
  const text = byId("page-text");
  text.textContent = "Loading the page text…";
  try {
    pageTextRequest ??= fetch("./assets/page-text.json").then((response) => {
      if (!response.ok) throw new Error("Page text unavailable");
      return response.json();
    });
    const pages = await pageTextRequest;
    if (requestedPage === currentPage) text.textContent = pages[requestedPage - 1];
  } catch {
    pageTextRequest = undefined;
    if (requestedPage === currentPage) text.textContent = "Page text is unavailable. You can open the original PDF above.";
  }
}

function showPage(page) {
  currentPage = page;
  const image = byId("page-image");
  image.src = `./assets/pages/${String(page).padStart(2, "0")}.webp`;
  image.alt = `Agreement page ${page} of ${PAGE_COUNT}. A text view follows below.`;
  pagePicker.value = String(page);
  pageViewport.scrollTo(0, 0);

  const existing = pageInitials.get(page);
  const initialMark = byId("page-initial-mark");
  initialMark.hidden = !existing;
  initialMark.textContent = existing || "";
  const complete = pageInitials.size === INITIAL_PAGE_COUNT;
  initialForm.hidden = page === 1;
  initialsField.value = existing || suggestedInitials();
  initialsField.setCustomValidity("");
  byId("apply-initials").textContent = existing ? "Update initials" : "Initial & continue";
  byId("initial-status").textContent = `${pageInitials.size} of ${INITIAL_PAGE_COUNT} pages initialled`;
  byId("page-status").textContent = existing
    ? `Page ${page} initialled: ${existing}`
    : page === 1 ? "Cover page" : `Page ${page} requires initials`;
  byId("previous-page").disabled = page === 1;
  byId("next-page").disabled = page === PAGE_COUNT;
  byId("continue-to-sign").hidden = !complete;
  updateNavigation();
  showTranscript();
}

function showConfirmation() {
  byId("confirm-name").value = ownerDetails.ownerName;
  byId("confirm-email").value = ownerDetails.email;
  byId("owner-signature-name").textContent = ownerDetails.ownerName;
  updateDates(submittedAt || new Date());
  renderSignature();
}

function updateDates(date) {
  const display = londonDate.format(date);
  byId("park-date").textContent = display;
  byId("owner-date").textContent = display;
  return display;
}

function storeDetails() {
  for (const field of detailsForm.querySelectorAll("[required]")) {
    field.setCustomValidity(field.value.trim() ? "" : "Please fill in this field.");
  }
  if (!detailsForm.reportValidity()) return false;

  const formData = new FormData(detailsForm);
  const details = Object.fromEntries([...formData].map(([key, value]) => [key, value.trim()]));
  details.marketing = formData.getAll("marketing");
  if (ownerDetails && JSON.stringify(ownerDetails) !== JSON.stringify(details)) {
    pageInitials.clear();
    signature = undefined;
    currentPage = 1;
    resetConsent();
    byId("initial-status").textContent = "0 of 13 pages initialled";
  }
  ownerDetails = details;
  return true;
}

detailsForm.addEventListener("input", (event) => event.target.setCustomValidity?.(""));
detailsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (storeDetails()) goToStep(1);
});

stepButtons.forEach((button, step) => button.addEventListener("click", () => {
  if (step === currentStep) return;
  if (currentStep === 0 && !storeDetails()) return;
  goToStep(step === 2 && pageInitials.size !== INITIAL_PAGE_COUNT ? 1 : step);
}));

pagePicker.addEventListener("change", () => showPage(Number(pagePicker.value)));
byId("page-transcript").addEventListener("toggle", showTranscript);
byId("page-zoom").addEventListener("change", (event) => {
  const zoom = event.target.value;
  const sheet = byId("page-sheet");
  if (zoom === "fit") sheet.style.removeProperty("--page-width");
  else sheet.style.setProperty("--page-width", `${Math.round(595.28 * Number(zoom) / 100)}px`);
  pageViewport.scrollTo(0, 0);
});
byId("previous-page").addEventListener("click", () => showPage(currentPage - 1));
byId("next-page").addEventListener("click", () => showPage(currentPage + 1));
byId("continue-to-sign").addEventListener("click", () => goToStep(2));
byId("edit-details").addEventListener("click", () => goToStep(0));
byId("back-to-review").addEventListener("click", () => goToStep(1));
initialsField.addEventListener("input", () => initialsField.setCustomValidity(""));

initialForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const initials = initialsField.value.trim().toLocaleUpperCase("en-GB");
  if (!/^[\p{L}\p{M}\p{N} .-]{1,8}$/u.test(initials) || !/[\p{L}\p{N}]/u.test(initials)) {
    initialsField.setCustomValidity("Enter your initials using up to eight characters.");
    initialsField.reportValidity();
    return;
  }
  const wasInitialled = pageInitials.has(currentPage);
  if (pageInitials.get(currentPage) !== initials) resetConsent();
  pageInitials.set(currentPage, initials);

  if (wasInitialled) showPage(currentPage);
  else if (currentPage < PAGE_COUNT) showPage(currentPage + 1);
  else if (pageInitials.size === INITIAL_PAGE_COUNT) goToStep(2);
  else {
    const firstMissing = Array.from({ length: INITIAL_PAGE_COUNT }, (_, i) => i + 2)
      .find((page) => !pageInitials.has(page));
    showPage(firstMissing);
  }
});

signatureButton.addEventListener("click", () => signatureBox.open(ownerDetails.ownerName, signature));
consent.addEventListener("change", () => {
  exportStatus.textContent = "";
});

byId("sign-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  exportStatus.classList.remove("error");
  if (!signature) {
    exportStatus.textContent = "Add your signature before downloading.";
    exportStatus.classList.add("error");
    signatureButton.focus();
    return;
  }

  const button = byId("download-button");
  if (button.disabled) return;
  button.disabled = true;
  exportStatus.textContent = "Creating your sample PDF…";
  const date = submittedAt || new Date();
  try {
    await downloadAgreement({
      details: ownerDetails,
      initials: new Map(pageInitials),
      signature,
      date: updateDates(date),
      consent: byId("consent-wording").textContent,
    });
    submittedAt = date;
    exportStatus.textContent = "Sample PDF downloaded. This preview sends no email.";
  } catch (error) {
    exportStatus.classList.add("error");
    exportStatus.textContent = error.message || "Could not create the PDF. Please try again.";
  } finally {
    button.disabled = false;
  }
});
