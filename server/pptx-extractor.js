import fs from "fs";
// jszip@2.x (pulled in by pptx-parser) lacks loadAsync, so import the 3.x copy bundled with pptxgenjs.
import JSZip from "./node_modules/pptxgenjs/node_modules/jszip/lib/index.js";

// Minimal PPTX text extractor for server-side use.
// Reads slide XMLs from the PPTX zip and pulls <a:t> text nodes.
export async function extractTextFromPptx(filePath) {
  const data = await fs.promises.readFile(filePath);
  const zip = await JSZip.loadAsync(data);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
    .sort();

  const chunks = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const matches = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)];
    matches.forEach(([, text]) => chunks.push(text));
  }

  return chunks.join("\n");
}
