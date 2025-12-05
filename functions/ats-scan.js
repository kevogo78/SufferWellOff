const DEFAULT_CLASSIFIER_MODEL = "mixtral-8x7b";

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
    console.error("Groq error:", res.status, text);
    throw new Error("Groq API error");
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();
  const { resume_text } = body;

  const systemPrompt = `
You are an Applicant Tracking System (ATS) resume scanner.
Your job is to:
- Evaluate ATS readability
- Flag structural/format issues (columns, tables, images, icons, weird bullets)
- Suggest improvements

Return strict JSON ONLY:
{
  "score": 0-100,
  "issues": ["...", "..."],
  "suggestions": ["...", "..."]
}
`;

  const userPrompt = `
Here is the resume text:

${resume_text || "(empty)"}
`;

  const raw = await callGroq(env, { system: systemPrompt, user: userPrompt });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("ATS JSON parse error:", raw);
    parsed = {
      score: 70,
      issues: ["Model response not in expected JSON format."],
      suggestions: [
        "Use simple bullet points.",
        "Avoid multi-column layouts and tables.",
      ],
    };
  }

  return Response.json(parsed);
}