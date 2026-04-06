const fs = require('fs');
const xml = fs.readFileSync('tmp_docx/word/document.xml', 'utf8');

// A simple regex to strip all XML tags
const cleanText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log(cleanText);
