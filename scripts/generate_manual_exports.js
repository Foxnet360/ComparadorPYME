const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

const projectRoot = path.resolve(__dirname, '..');
const mdPath = path.join(projectRoot, 'docs/manual/MANUAL_DE_USUARIO.md');
const outDir = path.join(projectRoot, 'docs/manual');
const htmlPath = path.join(outDir, 'Manual_de_Usuario_CSA.html');
const frozenHtmlPath = path.join(outDir, 'Manual_de_Usuario_CSA_frozen.html');
const pdfPath = path.join(outDir, 'Manual_de_Usuario_CSA.pdf');
const docxPath = path.join(outDir, 'Manual_de_Usuario_CSA.docx');

console.log('1. Reading markdown file...');
let mdContent = fs.readFileSync(mdPath, 'utf8');

// Convert GitHub-style alerts > [!NOTE] / > [!TIP] / > [!IMPORTANT] / > [!WARNING]
mdContent = mdContent.replace(/^>\s*\[!NOTE\][ \t]*\n((?:^>.*$\n?)*)/gim, (m, content) => {
  const clean = content.replace(/^>\s?/gm, '').trim();
  return `<div class="alert alert-note"><strong>Nota:</strong><br>${clean}</div>\n\n`;
});
mdContent = mdContent.replace(/^>\s*\[!TIP\][ \t]*\n((?:^>.*$\n?)*)/gim, (m, content) => {
  const clean = content.replace(/^>\s?/gm, '').trim();
  return `<div class="alert alert-tip"><strong>Consejo:</strong><br>${clean}</div>\n\n`;
});
mdContent = mdContent.replace(/^>\s*\[!IMPORTANT\][ \t]*\n((?:^>.*$\n?)*)/gim, (m, content) => {
  const clean = content.replace(/^>\s?/gm, '').trim();
  return `<div class="alert alert-important"><strong>Importante:</strong><br>${clean}</div>\n\n`;
});
mdContent = mdContent.replace(/^>\s*\[!WARNING\][ \t]*\n((?:^>.*$\n?)*)/gim, (m, content) => {
  const clean = content.replace(/^>\s?/gm, '').trim();
  return `<div class="alert alert-important"><strong>Advertencia:</strong><br>${clean}</div>\n\n`;
});

// Single-line alert fallback
mdContent = mdContent.replace(/^>\s*\[!NOTE\]\s*(.*)$/gim, '<div class="alert alert-note"><strong>Nota:</strong> $1</div>');
mdContent = mdContent.replace(/^>\s*\[!TIP\]\s*(.*)$/gim, '<div class="alert alert-tip"><strong>Consejo:</strong> $1</div>');
mdContent = mdContent.replace(/^>\s*\[!IMPORTANT\]\s*(.*)$/gim, '<div class="alert alert-important"><strong>Importante:</strong> $1</div>');

// Protect Mermaid diagrams from being mangled by marked.parse
const mermaidBlocks = [];
mdContent = mdContent.replace(/```mermaid([\s\S]*?)```/g, (match, code) => {
  const placeholder = `MERMAID_DIAGRAM_PLACEHOLDER_${mermaidBlocks.length}`;
  mermaidBlocks.push(code.trim());
  return `\n\n${placeholder}\n\n`;
});

// Convert images to base64 Data URIs so DOCX and PDF embed them with 100% reliability
mdContent = mdContent.replace(/!\[(.*?)\]\(\.\/assets\/screenshots\/(.*?)\)/g, (match, alt, filename) => {
  const imgFilePath = path.join(outDir, 'assets/screenshots', filename);
  if (fs.existsSync(imgFilePath)) {
    const ext = path.extname(filename).slice(1) || 'png';
    const b64 = fs.readFileSync(imgFilePath).toString('base64');
    const dataUri = `data:image/${ext};base64,${b64}`;
    return `<figure class="manual-figure"><img src="${dataUri}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`;
  }
  return match;
});

console.log('2. Parsing markdown to HTML...');
let parsedBody = marked.parse(mdContent);

// Restore pure, unescaped Mermaid blocks inside <div class="mermaid">
mermaidBlocks.forEach((code, index) => {
  const placeholder = `MERMAID_DIAGRAM_PLACEHOLDER_${index}`;
  const divTag = `<div class="mermaid">\n${code}\n</div>`;
  parsedBody = parsedBody.replace(new RegExp(`<p>\\s*${placeholder}\\s*<\\/p>`, 'g'), divTag);
  parsedBody = parsedBody.replace(new RegExp(placeholder, 'g'), divTag);
});

const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual de Usuario - Agente Comparador CSA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.8/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      fontFamily: 'Inter, sans-serif'
    });
  </script>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 {
      font-size: 22pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 12px;
      margin-top: 40px;
      margin-bottom: 24px;
      page-break-before: always !important;
      break-before: page !important;
    }
    body > h1:first-of-type,
    h1.cover-title {
      page-break-before: avoid !important;
      break-before: avoid !important;
      margin-top: 0;
    }
    h2 {
      font-size: 16pt;
      font-weight: 700;
      color: #1e1b4b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 32px;
      margin-bottom: 16px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #334155;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 11pt;
      font-weight: 600;
      color: #475569;
    }
    p {
      margin: 12px 0;
      text-align: justify;
    }
    ul, ol {
      margin: 10px 0 16px 24px;
    }
    li {
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 9px 12px;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      background: #f1f5f9;
      color: #4338ca;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: inherit;
      border: none;
      padding: 0;
    }
    .manual-figure {
      margin: 24px 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .manual-figure img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
      border: 1px solid #e2e8f0;
    }
    .manual-figure figcaption {
      margin-top: 8px;
      font-size: 8.5pt;
      color: #64748b;
      font-style: italic;
    }
    .alert {
      padding: 14px 18px;
      border-radius: 8px;
      margin: 18px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    .alert-note {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e3a8a;
    }
    .alert-tip {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      color: #064e3b;
    }
    .alert-important {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      color: #7f1d1d;
    }
    .mermaid {
      margin: 24px 0;
      text-align: center;
      page-break-inside: avoid;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
${parsedBody}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml);
console.log(`✓ HTML generated at: ${htmlPath}`);

console.log('3. Rendering Mermaid diagrams with headless Chrome into frozen DOM...');
const frozenCmd = `google-chrome --headless=new --virtual-time-budget=5000 --dump-dom "${htmlPath}"`;
const frozenHtml = execSync(frozenCmd, { maxBuffer: 100 * 1024 * 1024 }).toString();

if (frozenHtml.includes('Syntax error in text')) {
  console.error('CRITICAL ERROR: Mermaid syntax error detected in frozen DOM output!');
  process.exit(1);
}

fs.writeFileSync(frozenHtmlPath, frozenHtml);
console.log(`✓ Frozen HTML generated at: ${frozenHtmlPath}`);

console.log('4. Generating publication-quality PDF via headless Chrome...');
const pdfCmd = `google-chrome --headless=new --print-to-pdf="${pdfPath}" --no-pdf-header-footer --virtual-time-budget=4000 "${frozenHtmlPath}"`;
execSync(pdfCmd, { maxBuffer: 100 * 1024 * 1024 });
console.log(`✓ PDF generated at: ${pdfPath}`);

console.log('5. Converting to DOCX with LibreOffice...');
const libreofficeCmd = `soffice -env:UserInstallation=file:///tmp/LibreOffice_Export --headless --convert-to "docx:Office Open XML Text" "${frozenHtmlPath}" --outdir "${outDir}"`;
execSync(libreofficeCmd, { maxBuffer: 100 * 1024 * 1024 });

// Rename frozen docx to final name
const generatedDocx = path.join(outDir, 'Manual_de_Usuario_CSA_frozen.docx');
if (fs.existsSync(generatedDocx)) {
  fs.renameSync(generatedDocx, docxPath);
  console.log(`✓ DOCX generated at: ${docxPath}`);
}

console.log('All formats exported successfully!');
