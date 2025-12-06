const MODEL = "llama-3.3-70b-versatile";

export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json();

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
- Fix and standardize the contact line:
  * Proper city/state capitalization
  * Use the format: City, ST • email • phone
  * Normalize phone numbers to (XXX) XXX-XXXX
- Rewrite ALL experience into:
  * Job Title — Company (Location • Dates)
  * 2–6 strong achievement bullets per role
  * Use metrics or outcomes whenever possible
  * Infer the correct job title if unclear
- Validate and fix education formatting.
- Extract hidden skills from experience/projects.
- Expand the skills list using industry standards.
- Improve grammar, spelling, and clarity everywhere.
- Create a professional summary using:
  experience + education + skills + certifications + projects.
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

  return Response.json(JSON.parse(data.choices[0].message.content));
}
