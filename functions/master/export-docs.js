export async function onRequestPost(context) {
  const body = await context.request.json();

  // TODO: Generate Google Doc using Google Docs API
  // Placeholder demo URL:
  return Response.json({
    url: "https://docs.google.com/document/d/DEMO_DOCUMENT/edit"
  });
}
