const MODEL = "llama-3.3-70b-versatile";

async function callGroq(env, messages) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.3
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Groq API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    return json.choices[0].message.content;
}

export async function onRequestPost(context) {
    const { request, env } = context;

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }

    const {
        role,
        company = "",
        dates,
        existing_experience = "",
        existing_skills = ""
    } = body;

    if (!role || !dates) {
        return new Response("Missing required fields: role and dates", {
            status: 400
        });
    }

    const system = `
You are an elite resume experience generator.

CRITICAL RULES:
- Output ONLY valid JSON.
- DO NOT use markdown.
- DO NOT invent degrees, certifications, or tools not implied by the role.
- DO NOT reference other jobs.
- Generate EXACTLY 4 bullet points.
- Bullets must be achievement-focused, not task lists.
- Bullets should be realistic for the role and level.
- Use metrics where reasonable, but do not fabricate numbers.

FORMAT REQUIREMENTS:
- Experience block must be multi-line plain text.
- Use "•" for bullets.
- Role title must be normalized and professional.

OUTPUT FORMAT (JSON ONLY):

{
  "role": "Normalized Role Title",
  "company": "Company name or empty string",
  "dates": "Dates string",
  "experience_block": "Role — Company (Dates)\\n• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"]
}
`;

    const user = `
ROLE INPUT:
Title: ${role}
Company: ${company || "(not provided)"}
Dates: ${dates}

EXISTING EXPERIENCE (for tone only, do NOT reuse content):
${existing_experience || "(none)"}

EXISTING SKILLS (avoid duplicates):
${existing_skills || "(none)"}
`;

    try {
        const raw = await callGroq(env, [
            { role: "system", content: system },
            { role: "user", content: user }
        ]);

        // Remove accidental markdown if present
        const cleaned = raw.replace(/```json|```/gi, "").trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return new Response(
                "AI returned invalid JSON:\n\n" + cleaned,
                { status: 500 }
            );
        }

        // Final sanity check
        if (
            !parsed.experience_block ||
            !Array.isArray(parsed.skills) ||
            parsed.skills.length === 0
        ) {
            return new Response(
                "AI response missing required fields",
                { status: 500 }
            );
        }

        return new Response(JSON.stringify(parsed), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        console.error(err);
        return new Response(`Error generating job: ${err.message}`, {
            status: 500
        });
    }
}
