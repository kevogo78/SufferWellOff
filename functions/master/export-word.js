import JSZip from "jszip";

function paragraph(text) {
  return `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(str = "") {
  return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
}

export async function onRequestPost({ request }) {
  const { resume } = await request.json();

  const {
    name = "",
    contact = "",
    summary = "",
    experience = "",
    education = "",
    skills = "",
    certifications = "",
    projects = ""
  } = resume;

  const body = `
    ${paragraph(name)}
    ${paragraph(contact)}
    ${summary ? paragraph("Professional Summary") + paragraph(summary) : ""}
    ${paragraph("Experience")}
    ${experience.split("\n").map(paragraph).join("")}
    ${education ? paragraph("Education") + paragraph(education) : ""}
    ${skills ? paragraph("Skills") + paragraph(skills) : ""}
    ${certifications ? paragraph("Certifications & Awards") + paragraph(certifications) : ""}
    ${projects ? paragraph("Projects & Achievements") + paragraph(projects) : ""}
  `;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("word/document.xml", documentXml);
  zip.file("[Content_Types].xml", `
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Override PartName="/word/document.xml"
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>
  `);

  const buffer = await zip.generateAsync({ type: "uint8array" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=Resume.docx"
    }
  });
}
