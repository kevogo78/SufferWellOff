export async function onRequestPost(context) {
  const body = await context.request.json();

  return Response.json({
    score: 72,
    matched_keywords: ["Python", "SIEM", "Threat Analysis"],
    missing_keywords: ["MITRE ATT&CK", "Incident Response", "Log analysis"],
    recommendations: [
      "Add bullet referencing MITRE framework usage.",
      "Include measurable incident response experience.",
      "Mention hands-on log analysis or SIEM alerts."
    ]
  });
}