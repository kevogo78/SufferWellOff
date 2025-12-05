const DEFAULT_CLASSIFIER_MODEL = "mixtral-8x7b-32768";

async function callGroq(env, { system, user, model = DEFAULT_CLASSIFIER_MODEL }) {
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
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Groq ats-scan error:", res.status, text);
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
        console.warn("safeParseJson(inner) failed in ats-scan");
      }
    }
  }
  return fallback;
}

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();
  const { resume_text } = body;

  const systemPrompt = `
You are acting like an Applicant Tracking System (ATS) resume scanner.

Analyze the resume for:
- structural issues (columns, tables, images, text boxes)
- unclear section headings
- inconsistent date formats
- keyword clarity

Return ONLY JSON:
{
  "score": 0-100,
  "issues": ["...", "..."],
  "suggestions": ["...", "..."]
}
`;

  const userPrompt = `
RESUME TEXT:
${resume_text || "(empty)"}
`;

  const raw = await callGroq(env, { system: systemPrompt, user: userPrompt });
  const fallback = {
    score: 70,
    issues: ["Model response was not valid JSON."],
    suggestions: [
      "Use a single-column layout with no tables.",
      "Use standard headings: Experience, Education, Skills.",
    ],
  };

  const parsed = safeParseJson(raw, fallback);

  return Response.json(parsed);
}