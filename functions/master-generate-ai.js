export async function onRequestPost(context) {
  const body = await context.request.json();

  // Placeholder — later you’ll connect Groq here
  return Response.json({
    summary: "AI-enhanced summary placeholder...",
    experience: "AI-enhanced experience placeholder...",
    education: "AI-enhanced education placeholder...",
    skills: "AI-enhanced skills placeholder...",
    projects: "AI-enhanced project placeholder..."
  });
}