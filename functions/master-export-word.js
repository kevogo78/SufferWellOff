export async function onRequestPost(context) {
  const body = await context.request.json();

  const docContent = "Placeholder DOCX content for Master Resume.";

  return new Response(docContent, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=MasterResume.docx"
    }
  });
}