const MODEL = "llama-3.3-70b-versatile";

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function errorResponse(message, status = 400, details = undefined) {
  return jsonResponse(
    {
      error: message,
      ...(details ? { details } : {})
    },
    status
  );
}

async function callGroq(env, messages) {
  if (!env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.35
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(`Groq API invalid JSON: ${err.message}`);
  }
  return json.choices[0].message.content;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const debug = env.DEBUG === "true";

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const {
    job_title = "",
    job_description = "",
    job_url = "",
    source_type = "current",
    master_resume = {}
  } = body;

  let resolvedJobDescription = job_description;

  if (!resolvedJobDescription && job_url) {
    if (!isValidHttpUrl(job_url)) {
      return errorResponse("Job URL must be http or https", 400);
    }

    try {
      const resp = await fetch(job_url, {
        headers: { "User-Agent": "Tailr-AI/1.0" }
      });

      if (resp.ok) {
        const html = await resp.text();
        resolvedJobDescription = stripHtml(html).slice(0, 6000);
      }
    } catch (err) {
      if (debug) {
        console.log("tailor/analyze job URL fetch failed", err.message);
      }
    }
  }

  if (!resolvedJobDescription && !job_title) {
    return errorResponse("Job title or description required", 400);
  }

  const {
    name = "",
    contact = "",
    summary = "",
    experience = "",
    education = "",
    skills = "",
    certifications = "",
    projects = ""
  } = master_resume;

  if (debug) {
    console.log("tailor/analyze request", {
      job_title,
      hasDescription: Boolean(resolvedJobDescription),
      source_type
    });
  }

  const system = `
You are an elite resume tailoring engine.

CRITICAL RULES:
- Output ONLY valid JSON.
- DO NOT invent experience, tools, certifications, or degrees.
- DO NOT exaggerate titles or seniority.
- Use ONLY content already present in the resume.
- Rewrite bullets ONLY to emphasize relevance.
- Keep experience truthful and aligned.
- Do NOT add a "Target Role" line.

TASKS:
1. Generate a role-aligned professional profile (2–3 sentences).
2. Select and prioritize skills relevant to the job.
3. Rewrite ONLY relevant experience bullets to match job language.
4. Suggest optional extras the user may add manually.
5. Provide a numeric match score from 0-100 based on alignment.

OUTPUT FORMAT (JSON ONLY):

{
  "summary": "...",
  "skills": "...",
  "experience": "...",
  "extras": "...",
  "match_score": 0
}
`;

  const user = `
TARGET JOB:
Title: ${job_title}

JOB DESCRIPTION:
${resolvedJobDescription}

MASTER RESUME (VERIFIED):

Summary:
${summary}

Experience:
${experience}

Education:
${education}

Skills:
${skills}

Certifications:
${certifications}

Projects:
${projects}
`;

  try {
    const raw = await callGroq(env, [
      { role: "system", content: system },
      { role: "user", content: user }
    ]);

    const cleaned = raw.replace(/```json|```/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return errorResponse("AI returned invalid JSON", 500, cleaned);
    }

    if (!parsed.summary || !parsed.skills || !parsed.experience) {
      return errorResponse("AI response missing required fields", 500);
    }

    if (typeof parsed.match_score !== "number") {
      return errorResponse("AI response missing match score", 500);
    }

    parsed.match_score = Math.max(0, Math.min(100, Math.round(parsed.match_score)));

    return jsonResponse(parsed);
  } catch (err) {
    console.error(err);
    return errorResponse("Error tailoring resume", 500, err.message);
  }
}
