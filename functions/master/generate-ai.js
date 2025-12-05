const DEFAULT_WRITER_MODEL = "llama-3.3-70b-versatile";

// ----------------------------------------
// Helper: Call Groq with Cloudflare-safe fetch
// ----------------------------------------
async function callGroq(env, { system, user, model = DEFAULT_WRITER_MODEL }) {
  if (!env.GROQ_API_KEY) {
    console.error("ERROR: GROQ_API_KEY is missing from Cloudflare env!");
    throw new Error("Missing GROQ_API_KEY");
  }

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

    // REQUIRED for Cloudflare pages functions
    cf: { cacheTtl: 0 }
  });

  // Log status for debugging
  console.log("Groq API status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("Groq error body:", text);
    throw new Error("Groq returned non-200 response");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ----------------------------------------
// Safe JSON extraction
// ----------------------------------------
function safeParseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {}
    }
  }
  return fallback;
}

// ----------------------------------------
// MAIN FUNCTION
// ----------------------------------------
export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();

  // Debug: confirm secrets are loaded
  console.log("Loaded GROQ_API_KEY?", !!env.GROQ_API_KEY);

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
You are an expert resume writer for technical roles. Improve the text while:
- preserving truth
- adding clarity
- keeping ATS-safe formatting
Return ONLY JSON.
`;

  const userPrompt = `
Name: ${name || ""}
Title: ${title || ""}
Contact: ${contact || ""}

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

Return JSON with keys:
summary, experience, education, skills, projects
`;

  let raw;
  try {
    raw = await callGroq(env, { system: systemPrompt, user: userPrompt });
  } catch (err) {
    console.error("Groq call failed:", err);
    return new Response(
      JSON.stringify({ error: "Groq call failed", details: err.message }),
      { status: 500 }
    );
  }

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
