import JSZip from "jszip";

/**
 * Minimal XML escaping for Word
 */
function escapeXml(str = "") {
  return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
}

/**
 * Create a Word paragraph
 */
function paragraph(text) {
  return `
    <w:p>
      <w:r>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  `;
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resume = body.resume || {};

  const {
    name = "",
    contact = "",
    summary = "",
    skills = "",
    experience = "",
    extras = ""
  } = resume;

  if (!name || !experience) {
    return new Response(
        JSON.stringify({ error: "Missing required resume fields (name or experience)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build document body
  const bodyXml = `
    ${paragraph(name)}
    ${paragraph(contact)}

    ${summary ? paragraph("Profile") + paragraph(summary) : ""}

    ${skills ? paragraph("Key Skills") + paragraph(skills) : ""}

    ${paragraph("Relevant Experience")}
    ${experience
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(paragraph)
      .join("")}

    ${extras ? paragraph("Additional Notes") + paragraph(extras) : ""}
  `;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const zip = new JSZip();

  zip.file("[Content_Types].xml", contentTypesXml);
  zip.folder("word").file("document.xml", documentXml);

  const buffer = await zip.generateAsync({ type: "uint8array" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Tailored_Resume.docx"`
    }
  });
}
