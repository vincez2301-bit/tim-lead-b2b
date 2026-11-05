import { useId } from "react";

/** Logo Bigfish (vẽ lại dạng SVG): khung trắng, đuôi cá, khối xương, đầu cá và vảy sọc chéo trên nền đen. */
export function BigfishMark({ title = "Bigfish" }: { title?: string }) {
  const id = `bf-scale-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" fill="#000" />
      <path
        d="M8 4.5 Q4.5 4.5 4.5 9 V91 Q4.5 95.5 9 95.5 H91 Q95.5 95.5 95.5 91 V9.5 Q95.5 4.5 91 4.5 Z"
        fill="#fff"
      />
      <g fill="#000">
        <path d="M11.5 10 C19 11.5 25.5 15 26.8 23 C27.6 28.5 27.5 33 27.6 36.2 C21.5 34.4 15.5 32 13.2 27.6 C11.8 25 11.5 22 11.5 18.5 Z" />
        <path d="M27.4 38.6 C27.6 50.5 24.6 61.5 11.5 70 L11.5 52.5 C11.5 44.5 17.5 39.6 27.4 38.6 Z" />
        <rect x="30.5" y="16" width="61" height="38.5" rx="8" />
        <path d="M11.5 90 C11.5 74 21.5 59 47.5 56.2 V90 Z" />
        <rect x="50.5" y="57.8" width="3" height="32.2" />
      </g>
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M38.5 35.3 H83.5" />
        <path d="M38.5 20 V51 M83.5 20 V51" />
        <path d="M47.5 19 V33 M56.5 19 V33 M65.5 19 V33 M74.5 19 V33" />
        <path d="M47.5 38 V52 M56.5 38 V52 M65.5 38 V52 M74.5 38 V52" />
        <path d="M30.5 24.5 H35 M30.5 30 H35 M30.5 41 H35 M30.5 46.5 H35" />
        <path d="M87 24.5 H91.5 M87 30 H91.5 M87 41 H91.5 M87 46.5 H91.5" />
      </g>
      <circle
        cx="30"
        cy="75"
        r="4.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <clipPath id={id}>
        <path d="M53.5 57.8 H91.5 V84 Q91.5 90 85.5 90 H53.5 Z" />
      </clipPath>
      <g
        clipPath={`url(#${id})`}
        stroke="#000"
        strokeWidth="4.6"
        strokeLinecap="round"
      >
        <path d="M50 56 L88 93 M60 53 L98 90 M70 50 L108 87 M80 47 L118 84" />
      </g>
    </svg>
  );
}
