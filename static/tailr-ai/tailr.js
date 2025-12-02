let currentMode = "builder";

const modeButtons = document.querySelectorAll(".mode-btn");
const modeHint = document.getElementById("modeHint");
const jobCard = document.getElementById("jobCard");

const resumeInput = document.getElementById("resumeInput");
const jobInput = document.getElementById("jobInput");
const resumeCount = document.getElementById("resumeCount");
const jobCount = document.getElementById("jobCount");

const runBtn = document.getElementById("runBtn");
const statusText = document.getElementById("statusText");
const outputEl = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const pdfBtn = document.getElementById("pdfBtn");

const modeDescriptions = {
  builder:
    "Resume Builder: Paste raw info about yourself and let Tailr AI draft a complete resume.",
  tailor:
    "Resume Tailor: Paste your existing resume AND a job description. Tailr AI will tailor your resume for that role.",
  ats:
    "ATS Optimize: Improve keyword alignment, clarity, and structure so your resume is more ATS-friendly.",
  match:
    "Match Job Description: Paste your resume and a job description. Tailr AI will align your resume to this specific posting."
};

// --- Mode switching ---
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMode = btn.dataset.mode;

    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    modeHint.textContent = modeDescriptions[currentMode] || "";

    // Show job description area for these modes:
    if (currentMode === "tailor" || currentMode === "match" || currentMode === "ats") {
      jobCard.style.display = "block";
    } else {
      jobCard.style.display = "none";
    }
  });
});

// --- Character counters ---
function updateCounts() {
  resumeCount.textContent = `${resumeInput.value.length} characters`;
  jobCount.textContent = `${jobInput.value.length} characters`;
}

resumeInput.addEventListener("input", updateCounts);
jobInput.addEventListener("input", updateCounts);
updateCounts();

// --- Run Tailr AI ---
runBtn.addEventListener("click", async () => {
  const resumeText = resumeInput.value.trim();
  const jobText = jobInput.value.trim();

  if (!resumeText) {
    alert("Please paste your resume or experience information first.");
    return;
  }

  if (
    (currentMode === "tailor" || currentMode === "match" || currentMode === "ats") &&
    !jobText
  ) {
    const ok = confirm(
      "You did not paste a job description. For best results in this mode, include the job description. Continue anyway?"
    );
    if (!ok) return;
  }

  runBtn.disabled = true;
  statusText.textContent = "Calling Tailr AI via Groq…";
  outputEl.textContent = "Thinking…";

  try {
    const res = await fetch("/api/tailr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: currentMode,
        resumeText,
        jobText
      })
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content?.trim() ||
      "No response received from the AI.";

    outputEl.textContent = content;
    statusText.textContent = "Done ✔";
  } catch (err) {
    console.error(err);
    statusText.textContent = "Error";
    outputEl.textContent =
      "There was an error calling the Tailr AI backend. Please try again in a moment.";
  } finally {
    runBtn.disabled = false;
  }
});

// --- Copy result to clipboard ---
copyBtn.addEventListener("click", async () => {
  const text = outputEl.textContent.trim();
  if (!text) {
    alert("There is no output to copy yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    statusText.textContent = "Copied to clipboard ✅";
  } catch (e) {
    alert("Unable to copy. You can still select and copy manually.");
  }
});

// --- Download result as PDF ---
pdfBtn.addEventListener("click", () => {
  const text = outputEl.textContent.trim();
  if (!text) {
    alert("There is no output to export yet.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded. Please try again or refresh the page.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginLeft = 40;
  const marginTop = 40;
  const maxWidth = 515; // A4 width (595) - margins

  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, marginLeft, marginTop);

  doc.save("tailr-ai-resume.pdf");
});
