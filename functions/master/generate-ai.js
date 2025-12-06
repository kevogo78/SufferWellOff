const MODEL = "llama-3.3-70b-versatile";

export async function onRequestPost(context) {
  const env = context.env;

  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return new Response("Invalid JSON in request", { status: 400 });
  }

  const input = {
    name: body.name,
    contact: body.contact,
    experience: body.experience,
    education: body.education,
    skills: body.skills,
    projects: body.projects
  };

  const system = `
You are an elite resume writing engine.

RULES:
- Output ONLY valid JSON.
- DO NOT wrap JSON in markdown fences.
- Fix and standardize the contact line:
  * Proper city/state capitalization
  * Format: City, ST • email • phone
  * Normalize phone numbers to (XXX) XXX-XXXX
- Rewrite ALL experience into:
  * Job Title — Company (Location • Dates)
  * 2–6 strong achievement bullets per role
  * Use metrics or outcomes whenever possible
- Validate and fix education formatting.
- Expand skills list using hidden skills + experience.
- Create a professional summary using all sections.
`;

  const user = `
MASTER RESUME RAW INPUT:

Name: ${input.name}

Contact: ${input.contact}

Experience:
${input.experience}

Education:
${input.education}

Skills:
${input.skills}

Projects:
${input.projects}

Return JSON with keys:
contact, summary, experience, education, skills, projects
`;

  // === CALL GROQ ===
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
      temperature: 0.4
    })
  });

  const data = await resp.json();

  let raw = data.choices?.[0]?.message?.content || "";

  // === CLEAN AI RESPONSE (fixes your crash) ===
  raw = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return new Response("AI returned invalid JSON:\n\n" + raw, {
      status: 500
    });
  }

  return Response.json(parsed);
}
