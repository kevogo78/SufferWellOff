const MODEL = "llama-3.3-70b-versatile";

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

export async function onRequestPost(context) {
  const env = context.env;
  const debug = env.DEBUG === "true";

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const input = {
    name: body.name || "",
    contact: body.contact || "",
    experience: body.experience || "",
    education: body.education || "",
    skills: body.skills || "",
    certifications: body.certifications || "",
    projects: body.projects || ""
  };

  if (!env.GROQ_API_KEY) {
    return errorResponse("Missing GROQ_API_KEY", 500);
  }

  if (debug) {
    console.log("master/generate-ai request", {
      name: input.name,
      hasSummary: Boolean(body.summary),
      experienceLength: input.experience.length
    });
  }

  const system = `
You are a professional resume editor.

RULES (CRITICAL):
- Output ONLY valid JSON.
- DO NOT use markdown.
- DO NOT invent experience, skills, or credentials.
- Do NOT add roles or a "Target Role" section.
- Preserve factual content while improving clarity, grammar, and consistency.
- If experience is not already in bullet format, convert to bullets without adding new facts.

TASKS:
- Create or refine the professional summary based on experience, skills,
  education, certifications, and projects.
- Ensure skills are concise, standardized, and non-duplicated.
- Spell-check and standardize education and certifications.
- Normalize project titles for consistency.
`;

  const user = `
MASTER RESUME INPUT (ALREADY VERIFIED):

Name:
${input.name}

Contact Line:
${input.contact}

Professional Summary:
${body.summary || ""}

Experience (preserve content; format for readability only):
${input.experience}

Education:
${input.education}

Skills:
${input.skills}

Certifications & Awards:
${input.certifications}

Projects & Achievements:
${input.projects}

Return JSON with keys:
summary, education, skills, certifications, projects
`;

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.3
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    return errorResponse("Groq API error", resp.status, text);
  }

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    return errorResponse("Invalid Groq response", 500, err.message);
  }
  let raw = data?.choices?.[0]?.message?.content || "";

  raw = raw.replace(/```json|```/gi, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return errorResponse("Invalid AI JSON", 500, raw);
  }

  return jsonResponse(parsed);
}
