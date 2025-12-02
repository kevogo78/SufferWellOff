export async function onRequest(context) {
  const { request, env } = context;
  const { mode, text } = await request.json();

  const prompt =
    mode === "builder"
      ? `Build a full professional resume from this info:\n${text}`
      : `Rewrite and tailor this resume:\n${text}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: prompt }]
    })
  });

  return new Response(await response.text(), {
    headers: { "Content-Type": "application/json" }
  });
}

