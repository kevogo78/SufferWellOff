const DEFAULT_WRITER_MODEL = "llama-3-70b"; // replace with your exact Groq model id

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
    console.error("Groq error:", res.status, text);
    throw new Error("Groq API error");
  }

  const data = await res.json();
  return data.choices[0].message.content;
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
You ALWAYS:
- preserve factual content (no fabrication)
- quantify impact where information exists
- use concise bullet points
- keep everything ATS-safe (no tables, no icons, no fancy symbols)
- return STRICTLY valid JSON only.

You are improving a MASTER RESUME (all roles, all projects).
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

Please improve the text while preserving truth and relevance.

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
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse JSON from Groq:", raw);
    // fallback: send original back
    parsed = {
      summary: summary || "",
      experience: experience || "",
      education: education || "",
      skills: skills || "",
      projects: projects || "",
    };
  }

  return Response.json(parsed);
}