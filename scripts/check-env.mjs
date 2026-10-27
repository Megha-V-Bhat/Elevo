// Lists which .env.local variables are missing — names only, never values.
import { existsSync, readFileSync } from "node:fs";

const required = readFileSync(".env.example", "utf8").split(/\r?\n/).map((l) => l.split("=")[0].trim()).filter(Boolean);
if (!existsSync(".env.local")) {
  console.log("✗ .env.local not found. Copy .env.example to .env.local and fill it in (README → Setup).");
  process.exit(1);
}
const have = new Map(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().length > 0]),
);
const missing = required.filter((k) => !have.get(k));
console.log(missing.length ? `Missing values: ${missing.join(", ")}` : "✓ All variables in .env.example have values.");
