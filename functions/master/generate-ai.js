const MODEL = "llama-3.3-70b-versatile";

export async function onRequestPost(context) {
  const env = context.env;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
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

  const system = `
You are a professional resume editor.

RULES (CRITICAL):
- Output ONLY valid JSON.
- DO NOT use markdown.
- DO NOT invent experience, skills, or credentials.
- DO NOT rewrite job bullets or add roles.
- Improve clarity, grammar, and consistency only.

TASKS:
- Lightly polish the professional summary.
- Ensure skills are concise and non-duplicated.
- Ensure education and certifications are clearly formatted.
- Preserve all experience exactly as provided.
`;

  const user = `
MASTER RESUME INPUT (ALREADY VERIFIED):

Name:
${input.name}

Contact Line:
${input.contact}

Professional Summary:
${body.summary || ""}

Experience (DO NOT CHANGE CONTENT):
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

  const data = await resp.json();
  let raw = data?.choices?.[0]?.message?.content || "";

  raw = raw.replace(/```json|```/gi, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("Invalid AI JSON:\n\n" + raw, { status: 500 });
  }

  return Response.json(parsed);
}
