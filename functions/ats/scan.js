export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const resumeText = (body.resume_text || "").trim();

  if (!resumeText) {
    return Response.json({
      score: "N/A",
      issues: ["No resume text provided"],
      suggestions: ["Paste resume text to run ATS scan"]
    });
  }

  const issues = [];
  const suggestions = [];

  const textLower = resumeText.toLowerCase();

  // ---------- Section header checks ----------
  const requiredSections = [
    "experience",
    "education",
    "skills"
  ];

  requiredSections.forEach(section => {
    if (!textLower.includes(section)) {
      issues.push(`Missing or unclear "${section}" section`);
      suggestions.push(`Add a clear "${section.toUpperCase()}" heading`);
    }
  });

  // ---------- Bullet consistency ----------
  const bulletMatches = resumeText.match(/[•\-–]/g) || [];
  const uniqueBullets = new Set(bulletMatches);

  if (uniqueBullets.size > 2) {
    issues.push("Inconsistent bullet symbols detected");
    suggestions.push("Use a single bullet style throughout (• or -)");
  }

  // ---------- Long paragraph detection ----------
  resumeText.split("\n\n").forEach(block => {
    if (block.length > 600 && !block.includes("•")) {
      issues.push("Long paragraph detected (hard for ATS to parse)");
      suggestions.push("Break long paragraphs into bullet points");
    }
  });

  // ---------- Table / column heuristics ----------
  if (resumeText.includes("|") || resumeText.includes("\t")) {
    issues.push("Possible table or column formatting detected");
    suggestions.push("Avoid tables and columns; use plain text layout");
  }

  // ---------- Special character density ----------
  const specialCharCount = (resumeText.match(/[★✓✔►◆■]/g) || []).length;
  if (specialCharCount > 3) {
    issues.push("Excessive special characters detected");
    suggestions.push("Remove decorative symbols that ATS may ignore");
  }

  // ---------- Date format consistency ----------
  const datePatterns = resumeText.match(
      /\b(\d{4}|\w+\s\d{4})\b/g
  ) || [];

  const dateFormats = new Set(
      datePatterns.map(d => (d.match(/^\d{4}$/) ? "year" : "month-year"))
  );

  if (dateFormats.size > 1) {
    issues.push("Inconsistent date formats detected");
    suggestions.push("Standardize dates (e.g., Jan 2022 – Mar 2024)");
  }

  // ---------- Density heuristic ----------
  if (resumeText.length < 800) {
    issues.push("Resume content may be too short");
    suggestions.push("Add more detail to experience and skills");
  }

  // ---------- Score ----------
  let scoreLabel = "Good";

  if (issues.length >= 5) scoreLabel = "Poor";
  else if (issues.length >= 3) scoreLabel = "Fair";

  if (!issues.length) {
    suggestions.push("Resume structure looks ATS-friendly");
  }

  return Response.json({
    score: scoreLabel,
    issues,
    suggestions
  });
}
