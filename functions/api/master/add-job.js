const MODEL = "llama-3.3-70b-versatile";

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function errorResponse(message, status = 400, details = undefined) {
    return jsonResponse(
        {
            error: message,
            ...(details ? { details } : {})
        },
        status
    );
}

async function callGroq(env, messages) {
    if (!env.GROQ_API_KEY) {
        throw new Error("Missing GROQ_API_KEY");
    }

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

    let json;
    try {
        json = await res.json();
    } catch (err) {
        throw new Error(`Groq API invalid JSON: ${err.message}`);
    }
    return json.choices[0].message.content;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const debug = env.DEBUG === "true";

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("Invalid JSON body", 400);
    }

    const {
        role,
        company = "",
        dates,
        existing_experience = "",
        existing_skills = ""
    } = body;

    if (!role || !dates) {
        return errorResponse("Missing required fields: role and dates", 400);
    }

    if (debug) {
        console.log("master/add-job request", {
            role,
            company,
            dates
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
- Do NOT add a target role section or header.
- Return resume-ready language with action verbs.

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
            return errorResponse("AI returned invalid JSON", 500, cleaned);
        }

        // Final sanity check
        if (
            !parsed.experience_block ||
            !Array.isArray(parsed.skills) ||
            parsed.skills.length === 0
        ) {
            return errorResponse("AI response missing required fields", 500);
        }

        return jsonResponse(parsed);
    } catch (err) {
        console.error(err);
        return errorResponse("Error generating job", 500, err.message);
    }
}
