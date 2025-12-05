export async function onRequestPost(context) {
  const body = await context.request.json();

  return Response.json({
    url: "https://docs.google.com/document/d/TAILORED_DOC_PLACEHOLDER/edit"
  });
}
