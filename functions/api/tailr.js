export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const mode = body.mode || "builder";
  const resumeText = (body.resumeText || "").trim();
  const jobText = (body.jobText || "").trim();

  if (!resumeText) {
    return new Response(JSON.stringify({ error: "Missing resumeText" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  let userPrompt;

  switch (mode) {
    case "tailor":
      userPrompt = `
You are an expert resume writer for tech and cybersecurity roles.

Task: Tailor the following resume to the job description. Prioritize truthful alignment, strong measurable bullets, and clear structure.

Job Description:
${jobText || "(No job description provided, so do a general professional tailoring.)"}

Resume:
${resumeText}

Return ONLY the tailored resume in clean text (no commentary).
`;
      break;

    case "ats":
      userPrompt = `
You are an ATS optimization specialist.

Task: Optimize the resume below for Applicant Tracking Systems (ATS) while keeping it honest and readable for humans.

If a job description is provided, align keywords to it; otherwise, use common ATS keywords for cybersecurity / IT roles.

Job Description (optional):
${jobText || "(None provided)"}

Resume:
${resumeText}

Return ONLY the improved resume in clean text. Keep bullet formatting, avoid long paragraphs.
`;
      break;

    case "match":
      userPrompt = `
You are an expert resume and job-matching assistant.

Task: Adjust and rewrite the resume below so that it aligns as closely as possible with the job description, while staying truthful.

Make sure:
- Key responsibilities and accomplishments mirror the job description where honest.
- Keywords from the job description are incorporated naturally.
- Structure remains clear: Summary, Skills, Experience, Education, Projects (if applicable).

Job Description:
${jobText || "(No job description provided)"}

Resume:
${resumeText}

Return ONLY the matched-tuned resume in clean text.
`;
      break;

    case "builder":
    default:
      userPrompt = `
You are an expert professional resume writer.

Task: Create a complete, polished resume from the raw information below.
If data is missing (e.g., exact dates), make reasonable placeholders the user can edit.

Raw information:
${resumeText}

Return ONLY the final resume in clean text with clear sections: Summary, Skills, Experience, Education, Projects (if applicable).
`;
      break;
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are Tailr AI, a resume assistant for students and early-career professionals. Be concise, structured, and practical."
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    const text = await groqRes.text();

    // Forward Groq's JSON directly to the frontend
    return new Response(text, {
      status: groqRes.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error calling Groq API", detail: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
