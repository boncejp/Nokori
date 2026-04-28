import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "lib", "types", "database.ts");

const stdout = execFileSync(
  "supabase",
  ["gen", "types", "typescript", "--local", "--schema", "public"],
  { maxBuffer: 50 * 1024 * 1024 },
);

function decodeCliStdout(buffer) {
  // Windows の CLI が UTF-16 LE + BOM で出す場合のみ分岐（通常は UTF-8）
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString("utf16le");
  }

  return buffer.toString("utf8");
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, decodeCliStdout(stdout), "utf8");
