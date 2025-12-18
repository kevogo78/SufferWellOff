export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const resumeText = (body.resume_text || "").toLowerCase();
  const jobText = (body.job_description || "").toLowerCase();

  if (!resumeText || !jobText) {
    return Response.json({
      score: 0,
      matched_keywords: [],
      missing_keywords: [],
      recommendations: ["Provide both resume and job description text"]
    });
  }

  // ---------- Tokenization ----------
  function tokenize(text) {
    return Array.from(
        new Set(
            text
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(w => w.length > 2)
        )
    );
  }

  const resumeTokens = tokenize(resumeText);
  const jobTokens = tokenize(jobText);

  // ---------- Skill keyword emphasis ----------
  const skillKeywords = jobTokens.filter(word =>
      [
        "sql","python","java","linux","aws","azure","gcp","docker","kubernetes",
        "siem","splunk","elastic","nmap","wireshark","tcp","ip","firewall",
        "incident","response","threat","security","cloud","api","git","bash"
      ].includes(word)
  );

  // ---------- Responsibility verbs ----------
  const responsibilityTerms = jobTokens.filter(word =>
      [
        "analyze","monitor","design","implement","maintain","support","develop",
        "secure","automate","detect","respond","investigate","configure"
      ].includes(word)
  );

  // ---------- Matching ----------
  const matchedKeywords = jobTokens.filter(word =>
      resumeTokens.includes(word)
  );

  const missingKeywords = jobTokens.filter(word =>
      !resumeTokens.includes(word)
  );

  // ---------- Weighted scoring ----------
  const skillMatches = skillKeywords.filter(k =>
      resumeTokens.includes(k)
  ).length;

  const responsibilityMatches = responsibilityTerms.filter(k =>
      resumeTokens.includes(k)
  ).length;

  const skillScore = skillKeywords.length
      ? (skillMatches / skillKeywords.length) * 50
      : 25;

  const responsibilityScore = responsibilityTerms.length
      ? (responsibilityMatches / responsibilityTerms.length) * 35
      : 17.5;

  const terminologyScore = jobTokens.length
      ? (matchedKeywords.length / jobTokens.length) * 15
      : 7.5;

  let totalScore = Math.round(
      skillScore + responsibilityScore + terminologyScore
  );

  if (totalScore > 100) totalScore = 100;
  if (totalScore < 0) totalScore = 0;

  // ---------- Recommendations ----------
  const recommendations = [];

  if (skillKeywords.length && skillMatches < skillKeywords.length) {
    recommendations.push(
        "Consider adding or emphasizing missing technical skills from the job description"
    );
  }

  if (responsibilityTerms.length && responsibilityMatches < responsibilityTerms.length) {
    recommendations.push(
        "Align experience bullets more closely with job responsibilities"
    );
  }

  if (totalScore < 50) {
    recommendations.push(
        "Tailor resume sections to better reflect required tools and responsibilities"
    );
  }

  if (!recommendations.length) {
    recommendations.push(
        "Resume aligns well with the job description"
    );
  }

  return Response.json({
    score: totalScore,
    matched_keywords: matchedKeywords.slice(0, 20),
    missing_keywords: missingKeywords.slice(0, 20),
    recommendations
  });
}
