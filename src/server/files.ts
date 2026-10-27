import "server-only";
import { db } from "./supabase";

export const BUCKETS = {
  avatars: { maxBytes: 2 * 1024 * 1024, types: { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] } },
  resources: {
    maxBytes: 25 * 1024 * 1024,
    types: {
      "application/pdf": ["pdf"],
      "application/vnd.ms-powerpoint": ["ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
      "application/msword": ["doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
      "application/vnd.ms-excel": ["xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
      "text/plain": ["txt"],
      "image/png": ["png"],
      "image/jpeg": ["jpg", "jpeg"],
    },
  },
  "ask-attachments": {
    maxBytes: 10 * 1024 * 1024,
    types: { "application/pdf": ["pdf"], "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "image/webp": ["webp"] },
  },
} as const;
export type Bucket = keyof typeof BUCKETS;

/** Magic-byte sniffing so a renamed executable can't pass as a PDF. */
function sniff(buf: Uint8Array): string | null {
  const hex = Array.from(buf.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("52494646") && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "image/webp";
  if (hex.startsWith("504b0304")) return "zip"; // docx/pptx/xlsx
  if (hex.startsWith("d0cf11e0")) return "ole"; // doc/ppt/xls
  return null;
}

export async function validateFile(bucket: Bucket, file: File): Promise<string | null> {
  const rule = BUCKETS[bucket];
  if (file.size === 0) return "That file is empty.";
  if (file.size > rule.maxBytes) return `Files must be ${Math.round(rule.maxBytes / 1048576)} MB or smaller.`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const exts = (rule.types as Record<string, readonly string[]>)[file.type];
  if (!exts || !exts.includes(ext)) return "That file type isn't supported here.";
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniff(head);
  if (file.type === "text/plain") return kind && kind !== "text/plain" ? "That file's contents don't match its type." : null;
  if (kind === "zip") return ["docx", "pptx", "xlsx"].includes(ext) ? null : "That file's contents don't match its type.";
  if (kind === "ole") return ["doc", "ppt", "xls"].includes(ext) ? null : "That file's contents don't match its type.";
  return kind === file.type ? null : "That file's contents don't match its type.";
}

export const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "_").slice(-80);

/** 60-second signed URL. Storage RLS mirrors table RLS, so this fails for anyone not allowed. */
export async function signedUrl(bucket: Bucket, path: string | null | undefined, ttl = 60, download?: string) {
  if (!path) return null;
  const supabase = await db();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, Math.min(ttl, 60), download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
