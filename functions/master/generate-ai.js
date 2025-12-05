const DEFAULT_WRITER_MODEL = "llama3-70b-8192";

async function callGroq(env, { system, user, model = DEFAULT_WRITER_MODEL }) {
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
    console.error("Groq master-generate-ai error:", res.status, text);
    throw new Error("Groq API error");
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function safeParseJson(text, fallback) {
  try {
    // try direct parse first
    return JSON.parse(text);
  } catch {
    // try to extract first {...last}
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        console.warn("safeParseJson inner parse failed");
      }
    }
  }
  return fallback;
}

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();

  const {
    name,
    title,
    contact,
    summary,
    experience,
    education,
    skills,
    projects,
  } = body;

  const systemPrompt = `
You are an expert technical resume writer for cybersecurity, IT, software, and AI roles.

Your job: improve a MASTER RESUME draft (all roles, all projects), while:
- strictly preserving truth (no fabricating employers, titles, or tools)
- making bullet points clear, quantified where possible, and impact-focused
- keeping everything ATS-safe (no tables, no emojis, no fancy symbols)
- returning ONLY valid JSON (no commentary).

Write in clean US English, concise and professional.
`;

  const userPrompt = `
Here is the current master resume data:

Name: ${name || ""}
Target title: ${title || ""}
Contact line: ${contact || ""}

Summary:
${summary || ""}

Experience:
${experience || ""}

Education:
${education || ""}

Skills:
${skills || ""}

Projects:
${projects || ""}

Improve the text while preserving the underlying facts.

Return JSON with EXACTLY these keys:
{
  "summary": "...",
  "experience": "...",
  "education": "...",
  "skills": "...",
  "projects": "..."
}
`;

  const raw = await callGroq(env, { system: systemPrompt, user: userPrompt });

  const fallback = {
    summary: summary || "",
    experience: experience || "",
    education: education || "",
    skills: skills || "",
    projects: projects || "",
  };

  const parsed = safeParseJson(raw, fallback);

  return Response.json(parsed);
}
