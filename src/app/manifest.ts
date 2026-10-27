import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elevo · Academic mentoring",
    short_name: "Elevo",
    description: "Mentoring that grows with you.",
    start_url: "/login",
    display: "standalone",
    background_color: "#FAFBF8",
    theme_color: "#0F766E",
    icons: [
      { src: "/brand/elevo-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
