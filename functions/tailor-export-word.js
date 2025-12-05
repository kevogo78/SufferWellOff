export async function onRequestPost(context) {
  const body = await context.request.json();

  const docContent = "Placeholder DOCX content for Tailored Resume.";

  return new Response(docContent, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=TailoredResume.docx"
    }
  });
}