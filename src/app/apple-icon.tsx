import { ImageResponse } from "next/og";
import { OgMark } from "@/components/brand/og-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0F766E 0%, #0B4F4A 100%)" }}>
        <OgMark size={112} />
      </div>
    ),
    size,
  );
}
