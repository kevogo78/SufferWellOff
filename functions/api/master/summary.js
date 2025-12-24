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
            temperature: 0.4
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
        contact = "",
        experience = "",
        education = "",
        skills = "",
        certifications = "",
        projects = ""
    } = body;

    // Minimal guard: no experience = no summary
    if (!experience.trim()) {
        return jsonResponse({
            summary:
                "Professional summary will be generated once experience information is provided."
        });
    }

    if (debug) {
        console.log("master/summary request", {
            hasExperience: Boolean(experience.trim())
        });
    }

    const system = `
You are an elite professional resume summary writer.

CRITICAL RULES:
- Output ONLY valid JSON.
- DO NOT use markdown.
- DO NOT invent experience, tools, certifications, or degrees.
- DO NOT exaggerate titles or seniority.
- Summary must be 2–4 sentences.
- Write in third person, professional tone.
- Focus on strengths, impact, and direction.
- Use only information that is clearly implied by the input.
- Do NOT add a "Target Role" line.

OUTPUT FORMAT:

{
  "summary": "2–4 sentence professional summary"
}
`;

    const user = `
RESUME CONTENT (VERIFIED):

Contact Line:
${contact}

Experience:
${experience}

Education:
${education}

Skills:
${skills}

Certifications & Awards:
${certifications}

Projects & Achievements:
${projects}
`;

    try {
        const raw = await callGroq(env, [
            { role: "system", content: system },
            { role: "user", content: user }
        ]);

        const cleaned = raw.replace(/```json|```/gi, "").trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return errorResponse("AI returned invalid JSON", 500, cleaned);
        }

        if (
            !parsed.summary ||
            typeof parsed.summary !== "string" ||
            parsed.summary.split(".").length < 2
        ) {
            return errorResponse("AI returned an invalid or incomplete summary", 500);
        }

        return jsonResponse(parsed);
    } catch (err) {
        console.error(err);
        return errorResponse("Error generating summary", 500, err.message);
    }
}
