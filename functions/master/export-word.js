import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} from "docx";

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const resume = body.resume || {};

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

  if (!name || !experience) {
    return new Response(
        "Missing required resume fields (name or experience)",
        { status: 400 }
    );
  }

  // Helper to split bullet blocks
  function parseBullets(text) {
    return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.startsWith("•"))
        .map(line => line.replace(/^•\s*/, ""));
  }

  function section(title) {
    return new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 }
    });
  }

  const doc = new Document({
    sections: [
      {
        children: [
          // Name
          new Paragraph({
            children: [
              new TextRun({
                text: name,
                bold: true,
                size: 32
              })
            ],
            spacing: { after: 100 }
          }),

          // Contact line
          new Paragraph({
            children: [
              new TextRun({
                text: contact,
                italics: true,
                size: 22
              })
            ],
            spacing: { after: 300 }
          }),

          // Summary
          summary
              ? section("Professional Summary")
              : null,

          summary
              ? new Paragraph({
                text: summary,
                spacing: { after: 200 }
              })
              : null,

          // Experience
          section("Experience"),

          ...experience.split("\n\n").flatMap(block => {
            const lines = block.split("\n").map(l => l.trim());
            if (!lines.length) return [];

            const header = lines[0];
            const bullets = parseBullets(block);

            return [
              new Paragraph({
                text: header,
                bold: true,
                spacing: { before: 200 }
              }),

              ...bullets.map(
                  bullet =>
                      new Paragraph({
                        text: bullet,
                        bullet: { level: 0 }
                      })
              )
            ];
          }),

          // Education
          education
              ? section("Education")
              : null,

          education
              ? new Paragraph({
                text: education
              })
              : null,

          // Skills
          skills
              ? section("Skills")
              : null,

          skills
              ? new Paragraph({
                text: skills
              })
              : null,

          // Certifications
          certifications
              ? section("Certifications & Awards")
              : null,

          certifications
              ? new Paragraph({
                text: certifications
              })
              : null,

          // Projects
          projects
              ? section("Projects & Achievements")
              : null,

          projects
              ? new Paragraph({
                text: projects
              })
              : null
        ].filter(Boolean)
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Resume.docx"`
    }
  });
}
