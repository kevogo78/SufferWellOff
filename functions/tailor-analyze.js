const DEFAULT_WRITER_MODEL = "llama-3-70b";   // adjust to real Groq model id
const DEFAULT_CLASSIFIER_MODEL = "mixtral-8x7b"; // adjust as needed

async function callGroq(env, { system, user, model }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Groq error:", res.status, text);
    throw new Error("Groq API error");
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function fetchJobPageText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const html = await res.text();
    // very naive strip – model will handle extraction better
    return html.slice(0, 15000); // avoid huge prompts
  } catch (e) {
    console.error("Failed to fetch job url:", url, e);
    return "";
  }
}

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();

  const {
    job_title,
    job_description,
    job_url,
    style = "auto",
    master_resume,
  } = body;

  let combinedJD = job_description || "";

  if (!combinedJD && job_url) {
    const html = await fetchJobPageText(job_url);
    combinedJD = html; // Let the model extract relevant description from HTML-ish text
  }

  const systemWriter = `
You are a senior technical resume writer and job match expert.
Goal: TAILOR a resume to a specific job, while:
- keeping all roles (do NOT hallucinate new employers or titles),
- rewriting bullet points to highlight work that matches the job,
- only using achievements that could reasonably come from the existing roles,
- being honest and not fabricating skills or tools not implied by the resume.

Formatting rules:
- ATS-safe: no tables, no icons, no emojis.
- Use concise bullet points.
- Emphasize security / IT / AI details as relevant.

"style" parameter:
- "ats": ultra-plain, keyword-rich.
- "minimal": clean, concise, professional.
- "two-column": content is still plain text, but you can conceptually group skills separately.
- "military": helpful for veteran transitions; translate military language to civilian impact.
- "creative": you may be more expressive in wording, but still ATS-safe text.
`;

  const userWriter = `
JOB TITLE:
${job_title || ""}

JOB DESCRIPTION OR PAGE CONTENT:
${combinedJD || "(none provided)"}

MASTER RESUME INPUT:
${JSON.stringify(master_resume, null, 2)}

STYLE CHOICE: ${style}

Rewrite the resume content so that:
- All roles are kept (no employment gaps filled by fiction).
- Bullets are re-focused on responsibilities, tools, and achievements that match the job.
- Any irrelevant content may be shortened, but not deleted from history.
- The text remains truthful given the original resume.

Return STRICT JSON with exactly:
{
  "match_score": 0-100 integer estimating how well this candidate fits the job,
  "summary": "tailored professional summary",
  "skills": "tailored skills section text",
  "experience": "tailored experience section text with all roles preserved",
  "extras": "optional suggestions/lines to add before applying"
}
`;

  const rawWriter = await callGroq(env, {
    system: systemWriter,
    user: userWriter,
    model: DEFAULT_WRITER_MODEL,
  });

  let tailored;
  try {
    tailored = JSON.parse(rawWriter);
  } catch (e) {
    console.error("Failed to parse tailored JSON:", rawWriter);
    tailored = {
      match_score: 70,
      summary: master_resume.summary || "",
      skills: master_resume.skills || "",
      experience: master_resume.experience || "",
      extras:
        "Model failed to respond in the expected format; using original resume text.",
    };
  }

  // Optional: refine match_score using classifier model
  try {
    const systemClassifier = `
You are a classifier estimating resume/job match.
Return ONLY JSON: { "score": 0-100 }
`;
    const userClassifier = `
RESUME:
${tailored.summary}

${tailored.skills}

${tailored.experience}

JOB DESCRIPTION OR PAGE CONTENT:
${combinedJD}
`;

    const rawClassifier = await callGroq(env, {
      system: systemClassifier,
      user: userClassifier,
      model: DEFAULT_CLASSIFIER_MODEL,
    });

    const parsedClassifier = JSON.parse(rawClassifier);
    if (
      parsedClassifier &&
      typeof parsedClassifier.score === "number" &&
      parsedClassifier.score >= 0 &&
      parsedClassifier.score <= 100
    ) {
      tailored.match_score = parsedClassifier.score;
    }
  } catch (e) {
    console.warn("Classifier step failed, keeping writer match_score", e);
  }

  return Response.json({
    match_score: tailored.match_score,
    summary: tailored.summary,
    skills: tailored.skills,
    experience: tailored.experience,
    extras: tailored.extras,
  });
}