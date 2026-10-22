import type { ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Bus,
  Droplets,
  Landmark,
  Maximize,
  Palmtree,
  Radio,
  Settings2,
  Shield,
  Monitor,
  Zap,
} from "lucide-react";
import type { PublicState } from "../../shared/types";

export function DepartmentIcon({
  id,
  size = 20,
}: {
  id: string;
  size?: number;
}) {
  const Icon =
    (
      {
        agua: Droplets,
        energia: Zap,
        movilidad: Bus,
        comunicaciones: Radio,
        turismo: Palmtree,
        municipal: Landmark,
      } as const
    )[id as "agua"] || Shield;
  return <Icon size={size} strokeWidth={1.8} />;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-mark">
        <Shield size={25} />
      </span>
      <span>
        Cancún<small>BAJO ATAQUE</small>
      </span>
    </div>
  );
}
export function BrandPartners() {
  return (
    <div
      className="brand-partners"
      aria-label="Anáhuac Cancún e Instituto Artek"
    >
      <img
        className="partner-anahuac"
        src="/partners/anahuac-cancun.svg"
        alt="Anáhuac Cancún"
      />
      <span aria-hidden="true" className="partner-divider" />
      <div className="partner-artek">
        <img src="/partners/artek.webp" alt="Instituto Artek" />
      </div>
    </div>
  );
}
export function Shell({
  children,
  active = "monitor",
  connected = true,
  room,
}: {
  children: ReactNode;
  active?: string;
  connected?: boolean;
  room?: string;
}) {
  const administrator = active === "admin" || active === "guide";
  return (
    <div
      className={`experience-shell ${active === "player" ? "player-shell" : administrator ? "admin-shell" : "monitor-shell"}`}
    >
      <header className="experience-header">
        <Brand />
        <div className="experience-header-right">
          {administrator && (
            <nav aria-label="Herramientas de administrador">
              <a
                href="/docente"
                className={active === "admin" ? "current" : ""}
              >
                <Settings2 size={16} />
                <span>Control</span>
              </a>
              <a href="/guia" className={active === "guide" ? "current" : ""}>
                <BookOpen size={16} />
                <span>Guía</span>
              </a>
            </nav>
          )}
          <span className={`connection ${connected ? "" : "offline"}`}>
            <i />
            {connected ? "Conectado" : "Reconectando"}
          </span>
          {administrator && room && (
            <span className="room-tag">
              Sala <b>{room}</b>
            </span>
          )}
          <BrandPartners />
        </div>
      </header>
      {children}
      <footer className="experience-footer">
        <span>
          <Shield size={12} /> Simulación · no se realizan ataques reales
        </span>
        <span>Cancún, Quintana Roo</span>
      </footer>
    </div>
  );
}
export function Badge({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Timer({
  seconds,
  large = false,
}: {
  seconds: number;
  large?: boolean;
}) {
  const sec = Math.max(0, Math.ceil(seconds));
  return (
    <span className={`timer ${large ? "large" : ""}`}>
      {String(Math.floor(sec / 60)).padStart(2, "0")}
      <span>:</span>
      {String(sec % 60).padStart(2, "0")}
    </span>
  );
}
export function ErrorNote({
  error,
  close,
}: {
  error: string;
  close?: () => void;
}) {
  return error ? (
    <div className="error-note" role="alert">
      {error}
      {close && (
        <button aria-label="Cerrar aviso" onClick={close}>
          ×
        </button>
      )}
    </div>
  ) : null;
}
export function Scores({ state }: { state: PublicState }) {
  return (
    <div className="scores">
      <div>
        <Shield size={17} />
        <span>EQUIPO</span>
        <b>{state.scores.defenders}</b>
      </div>
      <span className="score-divider">—</span>
      <div className="attacker">
        <Activity size={17} />
        <span>IMPOSTOR</span>
        <b>{state.scores.impostor}</b>
      </div>
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {aside}
    </div>
  );
}
export function FullscreenButton() {
  return (
    <button
      className="icon-button"
      title="Pantalla completa"
      aria-label="Pantalla completa"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
    >
      <Maximize size={20} />
    </button>
  );
}
export function StatusIcon({ status }: { status: string }) {
  return status === "down" ? (
    <Activity size={22} />
  ) : status === "warning" ? (
    <Radio size={22} />
  ) : (
    <Monitor size={22} />
  );
}
