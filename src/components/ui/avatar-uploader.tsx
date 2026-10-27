"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { uploadAvatar } from "@/server/actions/profile";
import { Button } from "./button";
import { Avatar } from "./display";

const OUT = 512;

/** Pick (gallery or camera), crop to a square with zoom + drag, upload as WebP. */
export function AvatarUploader({ name, initialUrl, onUploaded }: { name: string; initialUrl: string | null; onUploaded?: (url: string | null) => void }) {
  const [url, setUrl] = useState(initialUrl);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const pick = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose an image file.");
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setSrc(URL.createObjectURL(f));
  };

  const save = async () => {
    const el = img.current;
    if (!el) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    const base = Math.min(el.naturalWidth, el.naturalHeight) / zoom;
    const view = 280; // preview size in CSS px
    const scale = base / view;
    const sx = (el.naturalWidth - base) / 2 - off.x * scale;
    const sy = (el.naturalHeight - base) / 2 - off.y * scale;
    ctx.drawImage(el, sx, sy, base, base, 0, 0, OUT, OUT);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob) {
      setBusy(false);
      return toast.error("Couldn't process that photo. Try another one.");
    }
    const fd = new FormData();
    fd.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
    const res = await uploadAvatar(fd);
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    setUrl(res.data.url);
    onUploaded?.(res.data.url);
    setSrc(null);
    toast.success("Photo updated");
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || "You"} src={url} size={72} ring />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => galleryRef.current?.click()}>
          <ImagePlus /> {url ? "Change photo" : "Add photo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => cameraRef.current?.click()} className="md:hidden">
          <Camera /> Take photo
        </Button>
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <BottomSheet open={!!src} onOpenChange={(v) => !v && setSrc(null)} title="Crop your photo" description="Drag to position, use the slider to zoom.">
        {src && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative size-[280px] cursor-grab touch-none overflow-hidden rounded-[28px] bg-canvas-sunk active:cursor-grabbing"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
              }}
              onPointerMove={(e) => drag.current && setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
              onPointerUp={() => (drag.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={img}
                src={src}
                alt="Photo to crop"
                draggable={false}
                onLoad={(e) => {
                  const t = e.currentTarget;
                  const s0 = 280 / Math.min(t.naturalWidth, t.naturalHeight);
                  setDims({ w: t.naturalWidth * s0, h: t.naturalHeight * s0 });
                }}
                className="absolute top-1/2 left-1/2 max-w-none select-none"
                style={{ transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px)) scale(${zoom})`, width: dims?.w ?? 280, height: dims?.h ?? 280 }}
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] ring-2 ring-white/80 ring-inset" />
            </div>
            <label className="flex w-full max-w-[280px] items-center gap-3 text-small font-semibold text-ink-700">
              Zoom
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-pine-600" />
            </label>
            <div className="flex w-full gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setSrc(null)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" loading={busy} onClick={save}>
                Save photo
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
