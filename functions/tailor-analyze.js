export async function onRequestPost(context) {
  const body = await context.request.json();

  const { job_title } = body;

  return Response.json({
    match_score: 72,
    summary: `Tailored summary for "${job_title}"...`,
    skills: "Reordered relevant skills...",
    experience: "Filtered relevant experience bullets...",
    extras: "Additional suggestions..."
  });
}