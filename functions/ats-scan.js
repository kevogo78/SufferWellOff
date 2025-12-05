export async function onRequestPost(context) {
  const body = await context.request.json();

  return Response.json({
    score: 84,
    issues: [
      "Potential use of tables or multi-column layout.",
      "Inconsistent date formatting.",
      "Heading structure unclear."
    ],
    suggestions: [
      "Use single-column layout.",
      "Standardize dates (MM YYYY).",
      "Use clear section headings."
    ]
  });
}