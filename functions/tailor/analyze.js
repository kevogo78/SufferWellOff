const MODEL = "llama-3.3-70b-versatile";

async function callGroq(env, messages) {
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

  const json = await res.json();
  return json.choices[0].message.content;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const {
    job_title = "",
    job_description = "",
    source_type = "current",
    master_resume = {}
  } = body;

  if (!job_description && !job_title) {
    return new Response("Job title or description required", { status: 400 });
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

  const system = `
You are an elite resume tailoring engine.

CRITICAL RULES:
- Output ONLY valid JSON.
- DO NOT invent experience, tools, certifications, or degrees.
- DO NOT exaggerate titles or seniority.
- Use ONLY content already present in the resume.
- Rewrite bullets ONLY to emphasize relevance.
- Keep experience truthful and aligned.

TASKS:
1. Generate a role-aligned professional profile (2–3 sentences).
2. Select and prioritize skills relevant to the job.
3. Rewrite ONLY relevant experience bullets to match job language.
4. Suggest optional extras the user may add manually.

OUTPUT FORMAT (JSON ONLY):

{
  "summary": "...",
  "skills": "...",
  "experience": "...",
  "extras": "..."
}
`;

  const user = `
TARGET JOB:
Title: ${job_title}

JOB DESCRIPTION:
${job_description}

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
      return new Response(
          "AI returned invalid JSON:\n\n" + cleaned,
          { status: 500 }
      );
    }

    if (!parsed.summary || !parsed.skills || !parsed.experience) {
      return new Response(
          "AI response missing required fields",
          { status: 500 }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response(`Error tailoring resume: ${err.message}`, {
      status: 500
    });
  }
}
