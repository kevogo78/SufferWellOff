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
            temperature: 0.4
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
        contact = "",
        experience = "",
        education = "",
        skills = "",
        certifications = "",
        projects = ""
    } = body;

    // Minimal guard: no experience = no summary
    if (!experience.trim()) {
        return new Response(
            JSON.stringify({
                summary:
                    "Professional summary will be generated once experience information is provided."
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
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
            return new Response(
                "AI returned invalid JSON:\n\n" + cleaned,
                { status: 500 }
            );
        }

        if (
            !parsed.summary ||
            typeof parsed.summary !== "string" ||
            parsed.summary.split(".").length < 2
        ) {
            return new Response(
                "AI returned an invalid or incomplete summary",
                { status: 500 }
            );
        }

        return new Response(JSON.stringify(parsed), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        console.error(err);
        return new Response(`Error generating summary: ${err.message}`, {
            status: 500
        });
    }
}
