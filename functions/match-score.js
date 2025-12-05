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
  const { resume_text, job_description } = body;

  const systemPrompt = `
You are an expert resume/job match analyzer.
Compare the RESUME and JOB DESCRIPTION.

Return strict JSON ONLY:
{
  "score": 0-100,
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword3", "keyword4"],
  "recommendations": ["advice 1", "advice 2"]
}
`;

  const userPrompt = `
RESUME:
${resume_text || "(empty)"}

JOB DESCRIPTION:
${job_description || "(empty)"}
`;

  const raw = await callGroq(env, { system: systemPrompt, user: userPrompt });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Match-score JSON parse error:", raw);
    parsed = {
      score: 60,
      matched_keywords: [],
      missing_keywords: [],
      recommendations: [
        "Ensure your resume explicitly mentions core tools and responsibilities from the job description.",
      ],
    };
  }

  return Response.json(parsed);
}