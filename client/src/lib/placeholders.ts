function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const HERO_PLACEHOLDER_IMAGE = svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="45%" stop-color="#111827" />
        <stop offset="100%" stop-color="#052e2b" />
      </linearGradient>
      <radialGradient id="glowA" cx="30%" cy="30%" r="45%">
        <stop offset="0%" stop-color="#34d399" stop-opacity="0.65" />
        <stop offset="100%" stop-color="#34d399" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="glowB" cx="80%" cy="20%" r="35%">
        <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#f8fafc" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="1600" height="1200" fill="url(#bg)" />
    <circle cx="420" cy="320" r="420" fill="url(#glowA)" />
    <circle cx="1240" cy="220" r="260" fill="url(#glowB)" />
    <path d="M0 980 C240 860 420 820 620 860 C780 890 960 1020 1180 1010 C1340 1000 1470 930 1600 840 L1600 1200 L0 1200 Z" fill="#020617" fill-opacity="0.45" />
  </svg>
`);

export const PRODUCT_PLACEHOLDER_IMAGE = svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#111827" />
        <stop offset="100%" stop-color="#1f2937" />
      </linearGradient>
      <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <rect width="800" height="1000" fill="url(#bg)" />
    <rect x="140" y="120" width="520" height="760" rx="36" fill="url(#card)" opacity="0.95" />
    <circle cx="400" cy="370" r="120" fill="#34d399" fill-opacity="0.22" />
    <path d="M285 310 H515 V620 H285 Z" fill="none" stroke="#e5e7eb" stroke-opacity="0.7" stroke-width="28" />
    <path d="M325 360 V585 H475 V360" fill="none" stroke="#e5e7eb" stroke-opacity="0.92" stroke-width="28" stroke-linecap="round" />
    <path d="M325 360 C325 320 355 290 400 290 C445 290 475 320 475 360" fill="none" stroke="#e5e7eb" stroke-opacity="0.92" stroke-width="28" stroke-linecap="round" />
  </svg>
`);
