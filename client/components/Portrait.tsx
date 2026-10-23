import { useId } from "react";
import { PORTRAIT_ASSETS } from "../../shared/identityCatalog";

const SKIN = [
  "#f0c9a6",
  "#d8a37a",
  "#b9845c",
  "#8c5a3c",
  "#f2d3bb",
  "#c48d67",
  "#a56d48",
  "#e4b590",
];
const HAIR = [
  "#2a1d17",
  "#5a3a26",
  "#16202e",
  "#7b4a2a",
  "#3a2a22",
  "#1c1c22",
  "#8a6a3c",
  "#4a2e22",
];
const CLOTHES = [
  "#2788e8",
  "#f58232",
  "#4a6fa5",
  "#d5662a",
  "#3f7f78",
  "#6c5aa8",
  "#2b6f9e",
  "#c25b5b",
];
const BACKDROP = [
  ["#eaf4ff", "#cfe3f7"],
  ["#fff1e4", "#f8d9bd"],
  ["#e8f4f0", "#cde6de"],
  ["#eef0fa", "#d3d8f0"],
];

function hairPath(style: number): string {
  switch (style % 4) {
    case 0:
      return "M23 33Q20 9 41 10Q63 9 58 33L50 21Q40 26 30 21Z";
    case 1:
      return "M21 38Q16 8 41 9Q66 8 60 38L56 25Q41 18 25 25Z";
    case 2:
      return "M24 31Q24 12 41 12Q57 12 57 31Q50 20 41 22Q31 20 24 31Z";
    default:
      return "M22 36Q18 10 41 10Q64 10 59 36Q58 22 41 21Q24 22 22 36Z";
  }
}

/**
 * Retrato ilustrado de una persona ficticia. Es un placeholder vectorial: no
 * es una fotografía ni una imagen generada con IA. Si existe un activo
 * sintético aprobado (ver `PORTRAIT_ASSETS`), se usa ese archivo local.
 */
export function Portrait({
  value,
  className = "credential-avatar",
}: {
  value: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const index = ((value % 8) + 8) % 8;
  const asset = PORTRAIT_ASSETS[index];
  if (asset)
    return (
      <span className={`portrait-asset ${className}`}>
        <img
          src={asset.src}
          alt={`Retrato sintético aprobado ${index + 1}`}
          width={80}
          height={100}
          loading="lazy"
          decoding="async"
        />
        <small>SINTÉTICO</small>
      </span>
    );
  const skin = SKIN[index];
  const hair = HAIR[(index * 3 + 1) % 8];
  const [from, to] = BACKDROP[index % 4];
  const gradient = `portrait-bg-${uid}`;
  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      role="img"
      aria-label={`Retrato ilustrado ${index + 1}, persona ficticia`}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="80" height="80" rx="9" fill={`url(#${gradient})`} />
      <path
        d={`M9 80c0-${index % 2 ? 20 : 24} 14-27 32-27s31 7 31 27Z`}
        fill={CLOTHES[index]}
      />
      <path d="M33 53l7 9 7-9" fill="#ffffff" opacity=".9" />
      <path d="M36 54v26M44 54v26" stroke="#123e70" strokeOpacity=".28" />
      <rect x="35" y="45" width="12" height="13" rx="4" fill={skin} />
      <ellipse cx="25" cy="36" rx="3" ry="5" fill={skin} />
      <ellipse cx="57" cy="36" rx="3" ry="5" fill={skin} />
      <ellipse
        cx="41"
        cy="34"
        rx={15 + (index % 3)}
        ry={19 + (index % 2)}
        fill={skin}
      />
      <path d={hairPath(index)} fill={hair} />
      {index % 5 === 3 && (
        <path d="M27 42Q41 62 55 42Q51 52 41 53Q31 52 27 42Z" fill={hair} />
      )}
      <ellipse cx="35" cy="34" rx="1.7" ry="2" fill="#1c2733" />
      <ellipse cx="47" cy="34" rx="1.7" ry="2" fill="#1c2733" />
      <path
        d="M31 29q4-2 7 0M44 29q4-2 7 0"
        fill="none"
        stroke={hair}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M41 36v6q-2 1.5 0 2"
        fill="none"
        stroke="#8c5f48"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d={index % 2 ? "M36 47q5 3.5 10 0" : "M37 47q4 2.5 8 0"}
        fill="none"
        stroke="#9a5a4c"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {index % 3 === 1 && (
        <path
          d="M29 33h10v7H29Zm13 0h10v7H42Zm-3 3h3"
          fill="none"
          stroke="#123e70"
          strokeWidth="1.4"
        />
      )}
      {index % 4 === 2 && <circle cx="24.5" cy="42" r="1.4" fill="#f6c453" />}
    </svg>
  );
}
