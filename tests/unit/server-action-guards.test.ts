import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every exported server action must authenticate before doing anything. */
const PUBLIC_ACTIONS = new Set(["signIn", "requestPasswordReset", "updatePassword", "signOut"]);
const GUARD = /(requireUser|requireRole|assertCanViewStudent|assertCanEditMentoring|assertCanViewThread)\(/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

const files = walk(join(process.cwd(), "src")).filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

describe("server action guards", () => {
  it("finds the server action files", () => expect(files.length).toBeGreaterThan(5));
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const fns = [...src.matchAll(/export async function (\w+)\s*\(/g)];
    for (const [i, m] of fns.entries()) {
      const name = m[1];
      if (PUBLIC_ACTIONS.has(name)) continue;
      it(`${file.split(/[\\/]src[\\/]/)[1]} → ${name} checks the caller`, () => {
        const body = src.slice(m.index, fns[i + 1]?.index ?? src.length);
        expect(GUARD.test(body)).toBe(true);
      });
    }
  }
});

describe("service role isolation", () => {
  it("the service-role client is only imported from /server/admin or API cron/import routes", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((f) => readFileSync(f, "utf8").includes("admin/client"))
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !/src\/server\/admin\/|src\/server\/actions\/auth\.ts|src\/app\/api\/(cron|imports)\//.test(f));
    expect(offenders).toEqual([]);
  });
  it("no client component imports server-only modules", () => {
    const offenders = walk(join(process.cwd(), "src")).filter((f) => {
      const s = readFileSync(f, "utf8");
      // Type-only imports are erased at build time and are fine.
      // @/server/admin/actions is a "use server" module (RPC boundary), so client imports of it are fine.
      return /^\s*["']use client["']/.test(s) && /^import (?!type )[^;]*from ["']@\/server\/(admin\/(?!actions|imports)|supabase|files|queries)/m.test(s);
    });
    expect(offenders).toEqual([]);
  });
});

describe("removed features stay removed", () => {
  const all = walk(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n").toLowerCase();
  it.each(["generativeai", "gemini", "ai_summar", "lowbandwidth", "low-bandwidth", "constellation", "leaderboard", "attendance", "dark:"])("no %s", (term) => {
    expect(all.includes(term)).toBe(false);
  });
});
