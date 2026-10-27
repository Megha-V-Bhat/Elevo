import { ImageResponse } from "next/og";
import { OgMark } from "@/components/brand/og-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Elevo — Mentoring that grows with you";

/** Pine Sunrise gradient, dot grid, white logo and tagline. */
export default function OgImage() {
  const dots = Array.from({ length: 34 * 18 }, (_, i) => i);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(135deg, #0B4F4A 0%, #0F766E 50%, #14B8A6 85%, #6EE7B7 100%)" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexWrap: "wrap", padding: 12, opacity: 0.18 }}>
          {dots.map((i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: 3, background: "#FFFFFF", margin: "15px 16px" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 90 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <OgMark size={120} />
            <div style={{ fontSize: 120, fontWeight: 800, color: "#FFFFFF", marginLeft: 24, letterSpacing: -4 }}>elevo</div>
          </div>
          <div style={{ fontSize: 52, color: "#FFFFFF", marginTop: 36, fontWeight: 700 }}>Mentoring that grows with you.</div>
          <div style={{ fontSize: 28, color: "#D5EFEA", marginTop: 14 }}>Academic records · mentoring · weekly wellbeing — for colleges</div>
        </div>
      </div>
    ),
    size,
  );
}
