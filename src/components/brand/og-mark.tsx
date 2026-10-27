/** White mark for generated images (satori renders inline SVG). */
export function OgMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d="M32 60 C32 50 32 42 32 31" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M31 43 C17 44 7 34 7 18 C22 18 31 28 31 43 Z" fill="#FFFFFF" />
      <path d="M33 33 C33 22 41 13 56 13 C56 26 47 34 33 33 Z" fill="#6EE7B7" />
      <circle cx="29" cy="9" r="5.5" fill="#FCD34D" />
    </svg>
  );
}
