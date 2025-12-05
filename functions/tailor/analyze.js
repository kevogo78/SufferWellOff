const DEFAULT_WRITER_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_CLASSIFIER_MODEL = "mixtral-8x7b-32768";

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
    console.error("Groq tailor-analyze error:", res.status, text);
    throw new Error("Groq API error");
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function safeParseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        console.warn("safeParseJson(inner) failed in tailor-analyze");
      }
    }
  }
  return fallback;
}

async function fetchJobPageText(url) {
  if (!url) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("fetchJobPageText non-200:", res.status);
      return "";
    }
    const html = await res.text();
    // limit length so prompts don't explode
    return html.slice(0, 15000);
  } catch (e) {
    console.error("fetchJobPageText error:", e);
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
    const page = await fetchJobPageText(job_url);
    combinedJD = page;
  }

  const styleHint = (() => {
    switch (style) {
      case "ats":
        return "Use ultra-plain ATS-safe wording. Prioritize clarity and keywords over flair.";
      case "minimal":
        return "Use clean, concise, minimal prose. Professional but not stiff.";
      case "two-column":
        return "Assume skills can be visually grouped in a side column, but still write plain text.";
      case "military":
        return "Translate military language into civilian impact. Emphasize leadership, risk management, mission outcomes.";
      case "creative":
        return "You may be a bit more expressive in wording, but keep the text itself ATS-safe.";
      default:
        return "Use a balanced professional tone appropriate for ATS and recruiters.";
    }
  })();

  const systemWriter = `
You are a senior technical resume writer and job-match expert.

Goal: TAILOR a resume to a specific job while:
- keeping ALL roles (do NOT invent or remove employers or titles)
- rewriting bullet points to emphasize work that matches the job description
- only including achievements that could reasonably come from the original roles
- never fabricating skills, tools, or duties the candidate does not have

Formatting:
- ATS-safe: plain text, bullet-style content, no tables/emojis/icons
- Focus on impact, metrics, tools, security/IT/AI detail as relevant

${styleHint}

Return ONLY valid JSON, no commentary.
`;

  const userWriter = `
JOB TITLE:
${job_title || ""}

JOB DESCRIPTION OR PAGE CONTENT:
${combinedJD || "(none provided)"}

MASTER RESUME INPUT (JSON):
${JSON.stringify(master_resume || {}, null, 2)}

Requirements:
- Keep all roles in the experience history.
- You may shorten or reorder, but do NOT delete roles or invent new ones.
- Make bullets strongly aligned with the job's responsibilities and required skills.
- Be honest: if the resume doesn't support something, don't claim it.

Return JSON exactly as:
{
  "match_score": 0-100,
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

  let tailored = safeParseJson(rawWriter, {
    match_score: 70,
    summary: master_resume?.summary || "",
    skills: master_resume?.skills || "",
    experience: master_resume?.experience || "",
    extras:
      "The AI response could not be parsed cleanly. Using original resume text.",
  });

  // Optional second pass: more precise match score
  try {
    const systemClassifier = `
You are an expert classifier. Estimate how well a resume matches a job.

Return ONLY compact JSON:
{ "score": 0-100 }
`;
    const userClassifier = `
TAILORED RESUME:
Summary:
${tailored.summary}

Skills:
${tailored.skills}

Experience:
${tailored.experience}

JOB DESCRIPTION OR PAGE CONTENT:
${combinedJD}
`;

    const rawClassifier = await callGroq(env, {
      system: systemClassifier,
      user: userClassifier,
      model: DEFAULT_CLASSIFIER_MODEL,
    });

    const parsedClassifier = safeParseJson(rawClassifier, null);
    if (
      parsedClassifier &&
      typeof parsedClassifier.score === "number" &&
      parsedClassifier.score >= 0 &&
      parsedClassifier.score <= 100
    ) {
      tailored.match_score = parsedClassifier.score;
    }
  } catch (e) {
    console.warn("tailor-analyze classifier step failed, keeping writer score", e);
  }

  return Response.json({
    match_score: tailored.match_score,
    summary: tailored.summary,
    skills: tailored.skills,
    experience: tailored.experience,
    extras: tailored.extras,
  });
}
