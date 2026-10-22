import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  MapPin,
  Minus,
  Plus,
  Rotate3D,
  Pause,
  Play,
  Box,
  Waves,
  Eye,
} from "lucide-react";
import type { DepartmentState } from "../../shared/types";
import { DepartmentIcon } from "./UI";
import { SERVICE_SITES } from "../three/sites";
import type { CityViewport } from "../three/CityViewport";
import { getCityImpacts } from "../three/impactLabels";

const statusNames = {
  operational: "En línea",
  warning: "En riesgo",
  down: "Fuera de línea",
};
export default function CityMap({
  departments,
  demo = false,
  revealedImpostor,
}: {
  departments: DepartmentState[];
  demo?: boolean;
  revealedImpostor?: { departmentId: string; name: string };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [animated, setAnimated] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<CityViewport | null>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const latest = useRef(departments);
  latest.current = departments;
  const selection = useRef(selected);
  selection.current = selected;
  const dep = departments.find((d) => d.id === selected);
  const site = SERVICE_SITES.find((s) => s.id === selected);
  const impacts = getCityImpacts(departments);

  useEffect(() => {
    if (revealedImpostor) viewport.current?.reset();
    setSelected(revealedImpostor?.departmentId ?? null);
  }, [revealedImpostor?.departmentId]);

  useEffect(() => {
    let cancelled = false;
    void import("../three/CityViewport")
      .then(({ createCityViewport }) => {
        if (cancelled || !host.current) return;
        try {
          viewport.current = createCityViewport(host.current, {
            onSelect: (id) =>
              setSelected((value) => (value === id ? null : id)),
            onLabels: (positions) => {
              for (const [id, position] of Object.entries(positions)) {
                const label = labels.current.get(id);
                if (!label) continue;
                label.style.left = `${position.x}px`;
                label.style.top = `${position.y}px`;
                label.style.opacity = position.visible ? "1" : "0";
                label.style.pointerEvents = position.visible ? "auto" : "none";
              }
            },
            onFailure: () => {
              viewport.current?.dispose();
              viewport.current = null;
              if (!cancelled) setFallback(true);
            },
          });
          viewport.current.update(latest.current);
          viewport.current.select(selection.current);
          setReady(true);
        } catch (error) {
          console.warn(
            "Vista 3D no disponible; se conserva la vista accesible.",
            error instanceof Error ? error.message : "WebGL",
          );
          setFallback(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });
    return () => {
      cancelled = true;
      viewport.current?.dispose();
      viewport.current = null;
    };
  }, []);
  useEffect(() => {
    viewport.current?.update(departments);
  }, [departments]);
  useEffect(() => {
    viewport.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    viewport.current?.setAnimated(animated);
  }, [animated, ready]);

  return (
    <div className={`city-map city-map-3d ${fallback ? "has-fallback" : ""}`}>
      <div className="map-toolbar">
        <span>
          <MapPin size={14} /> CANCÚN · CIUDAD VIVA
        </span>
        <span className="map-view-badge">
          <Box size={13} /> {fallback ? "VISTA ACCESIBLE" : "MAQUETA 3D"}
        </span>
      </div>
      {revealedImpostor && (
        <div className="city-reveal-callout" role="status" aria-live="polite">
          <Eye size={30} />
          <div>
            <span>IMPOSTOR REVELADO</span>
            <strong>{revealedImpostor.name}</strong>
            <p>
              Se ocultaba en{" "}
              {departments.find((d) => d.id === revealedImpostor.departmentId)
                ?.name || revealedImpostor.departmentId}
            </p>
          </div>
        </div>
      )}
      <div
        className="city-canvas"
        ref={host}
        role="img"
        aria-label={`Ciudad 3D de Cancún con personas en las calles y los servicios de ${departments.map((d) => d.name).join(", ")}.${impacts.length ? ` Problemas visibles: ${impacts.map((i) => i.label).join(", ")}.` : ""}`}
      />
      {impacts.length > 0 && (
        <div
          className="city-life-status"
          aria-label="Efectos de los problemas en la ciudad"
        >
          {impacts.map((i) => (
            <span key={i.id} className={i.status}>
              <b>{i.name}</b> · {i.label}
            </span>
          ))}
        </div>
      )}
      {!ready && !fallback && (
        <div className="city-loading" role="status">
          <Box size={30} />
          <b>Construyendo la ciudad…</b>
          <span>Torres, calles y servicios en 3D</span>
        </div>
      )}
      {fallback ? (
        <div className="city-fallback">
          <Waves size={35} />
          <h3>Cancún · Infraestructura urbana</h3>
          <p>
            WebGL no está disponible en este dispositivo. Puedes consultar todos
            los servicios y sus estados aquí.
          </p>
          <div className="city-fallback-services">
            {departments.map((d) => (
              <button
                key={d.id}
                className={`city-fallback-service ${d.status} ${revealedImpostor?.departmentId === d.id ? "revealed-impostor" : ""}`}
                onClick={() => setSelected(d.id)}
              >
                <DepartmentIcon id={d.id} size={28} />
                <b>{d.name}</b>
                <span>{statusNames[d.status]}</span>
                {impacts.find((i) => i.id === d.id) && (
                  <small>{impacts.find((i) => i.id === d.id)?.label}</small>
                )}
                {revealedImpostor?.departmentId === d.id && (
                  <strong>IMPOSTOR · {revealedImpostor.name}</strong>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="city-labels">
            {departments.map((d) => (
              <button
                ref={(element) => {
                  if (element) labels.current.set(d.id, element);
                  else labels.current.delete(d.id);
                }}
                key={d.id}
                className={`city-label ${d.status} ${selected === d.id ? "selected" : ""} ${revealedImpostor?.departmentId === d.id ? "revealed-impostor" : ""}`}
                onClick={() =>
                  setSelected((value) => (value === d.id ? null : d.id))
                }
                aria-label={`${d.name}: ${statusNames[d.status]}${revealedImpostor?.departmentId === d.id ? ` · IMPOSTOR: ${revealedImpostor.name}` : ""}`}
                aria-pressed={selected === d.id}
                title={SERVICE_SITES.find((s) => s.id === d.id)?.description}
              >
                <DepartmentIcon id={d.id} size={14} />
                <span>
                  {SERVICE_SITES.find((s) => s.id === d.id)?.short || d.name}
                  <small className="city-label-status">
                    {statusNames[d.status]}
                  </small>
                  {revealedImpostor?.departmentId === d.id && (
                    <strong className="city-impostor-name">
                      IMPOSTOR · {revealedImpostor.name}
                    </strong>
                  )}
                </span>
                <i />
              </button>
            ))}
          </div>
          <span className="city-water-note">MAR CARIBE · LAGUNA NICHUPTÉ</span>
          <div className="city-interaction-hint">
            <Rotate3D size={14} />
            <span>Arrastra para girar · Rueda o pinza para acercar</span>
          </div>
        </>
      )}
      {dep && (
        <div className="map-detail city-detail">
          <DepartmentIcon id={dep.id} size={23} />
          <div>
            <b>
              {dep.name}{" "}
              <em className={dep.status}>{statusNames[dep.status]}</em>
            </b>
            <span>{site?.description}</span>
            {revealedImpostor?.departmentId === dep.id && (
              <strong className="city-impostor-name">
                IMPOSTOR · {revealedImpostor.name}
              </strong>
            )}
            <small>
              {dep.connected
                ? "Terminal conectada"
                : dep.occupied
                  ? "Terminal sin conexión · no es un ataque"
                  : "Puesto disponible"}
            </small>
          </div>
          <button onClick={() => setSelected(null)} aria-label="Cerrar detalle">
            ×
          </button>
        </div>
      )}
      <div className="map-bottom">
        <span className="map-legend">
          <i /> En línea <i className="warn" /> En riesgo{" "}
          <i className="danger" /> Fuera de línea
        </span>
        {!fallback && (
          <div className="map-controls">
            <button
              disabled={!ready}
              onClick={() => viewport.current?.zoom(-1)}
              aria-label="Alejar ciudad"
            >
              <Minus size={16} />
            </button>
            <button
              disabled={!ready}
              onClick={() => viewport.current?.zoom(1)}
              aria-label="Acercar ciudad"
            >
              <Plus size={16} />
            </button>
            <button
              disabled={!ready}
              onClick={() => viewport.current?.reset()}
              aria-label="Restablecer vista isométrica"
              title="Vista inicial"
            >
              <Crosshair size={16} />
            </button>
          </div>
        )}
      </div>
      <div
        className="city-service-picker"
        aria-label="Seleccionar un servicio de la ciudad"
      >
        {departments.map((d) => (
          <button
            key={d.id}
            className={`${d.status} ${selected === d.id ? "selected" : ""} ${revealedImpostor?.departmentId === d.id ? "revealed-impostor" : ""}`}
            aria-pressed={selected === d.id}
            onClick={() =>
              setSelected((value) => (value === d.id ? null : d.id))
            }
          >
            <DepartmentIcon id={d.id} size={13} />
            <span>
              {SERVICE_SITES.find((s) => s.id === d.id)?.short || d.name}
            </span>
            {revealedImpostor?.departmentId === d.id && <b>IMPOSTOR</b>}
          </button>
        ))}
      </div>
      <span className="map-footnote">
        MAQUETA ESQUEMÁTICA · NO A ESCALA{" "}
        {demo ? "· DEMOSTRACIÓN" : "· ESTADO PÚBLICO"}
      </span>
    </div>
  );
}
