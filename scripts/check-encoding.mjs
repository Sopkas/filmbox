import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "npm-cache",
  ".tmpgo",
  "photo"
]);
const EXCLUDED_SUFFIXES = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".pdf",
  ".mp4",
  ".lock"
];

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      await walk(fullPath, out);
      continue;
    }

    const lower = entry.name.toLowerCase();
    if (EXCLUDED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      continue;
    }

    out.push(fullPath);
  }

  return out;
}

async function main() {
  const files = await walk(ROOT);
  const errors = [];

  for (const file of files) {
    const content = await fs.readFile(file);
    const text = content.toString("utf8");
    const relativePath = path.relative(ROOT, file);

    // UTF-8 BOM should not be present because it breaks JSON/config parsers.
    if (content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
      errors.push(`${relativePath} (UTF-8 BOM)`);
    }

    if (text.includes("\uFFFD")) {
      errors.push(`${relativePath} (replacement character)`);
    }

    // Common mojibake markers when UTF-8 text is interpreted as cp1251/latin-1.
    const hasLatinMojibake = /[\u00d0\u00d1\u00c3\u00e2][^\s]/.test(text) || /\u00ef\u00bb\u00bf/.test(text);
    const hasCyrillicPairMojibake = /([РС][\u0400-\u04ff]){6,}/.test(text);
    if (hasLatinMojibake || hasCyrillicPairMojibake) {
      errors.push(`${relativePath} (possible mojibake)`);
    }
  }

  if (errors.length > 0) {
    console.error("Found potential encoding issues:");
    for (const file of errors) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }

  console.log(`Encoding check passed for ${files.length} files.`);
}

main().catch((error) => {
  console.error("Encoding check failed:", error);
  process.exit(1);
});
