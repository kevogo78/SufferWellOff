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
    console.error("Groq match-score error:", res.status, text);
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
        console.warn("safeParseJson(inner) failed in match-score");
      }
    }
  }
  return fallback;
}

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();
  const { resume_text, job_description } = body;

  const systemPrompt = `
You are a resume/job match analyzer.

Compare a RESUME and a JOB DESCRIPTION and return:
- Overall match score (0-100)
- Keywords or skills that clearly appear in both
- Important keywords/skills present in JD but missing in resume
- Concrete recommendations to improve the match without lying

Return ONLY JSON:
{
  "score": 0-100,
  "matched_keywords": ["...", "..."],
  "missing_keywords": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;

  const userPrompt = `
RESUME:
${resume_text || "(empty)"}

JOB DESCRIPTION:
${job_description || "(empty)"}
`;

  const raw = await callGroq(env, { system: systemPrompt, user: userPrompt });

  const fallback = {
    score: 60,
    matched_keywords: [],
    missing_keywords: [],
    recommendations: [
      "Make sure your resume explicitly mentions the core tools and responsibilities from the job description.",
    ],
  };

  const parsed = safeParseJson(raw, fallback);

  return Response.json(parsed);
}