const fs = require('fs');
const xml = fs.readFileSync('tmp_docx/word/document.xml', 'utf8');
const cleanText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
fs.writeFileSync('docx_utf8.txt', cleanText, 'utf8');
