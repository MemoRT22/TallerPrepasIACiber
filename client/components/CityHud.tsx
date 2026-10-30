import type { CityNarrative } from "../../shared/types";
import { DEPARTMENTS } from "../../shared/types";

export default function CityHud({ city }: { city: CityNarrative }) {
  const scarred = city.services.filter((s) => s.memory === "scarred").length;
  const recovered = city.services.filter(
    (s) => s.memory === "recovered",
  ).length;
  return (
    <section
      className={`city-hud ${city.status}`}
      aria-label="Estabilidad narrativa de Cancún"
    >
      <div className="city-stability">
        <span>ESTABILIDAD DE LA CIUDAD</span>
        <strong>
          {city.stability}
          <small> / 100</small>
        </strong>
        <meter
          min={0}
          max={100}
          value={city.stability}
          aria-label="Estabilidad de la ciudad"
        />
      </div>
      <div className="city-story">
        <b>
          {
            {
              normal: "NORMAL",
              risk: "EN RIESGO",
              critical: "CRÍTICO",
              recovering: "EN RECUPERACIÓN",
            }[city.status]
          }
        </b>
        <p key={city.message} className="city-microtransition" role="status">
          {city.message}
        </p>
        <small>
          {scarred
            ? `${scarred} servicios con huella previa · no son bloqueos actuales`
            : recovered
              ? `${recovered} servicios recuperados · actividad restaurada`
              : "Sin secuelas acumuladas"}{" "}
          · indicador narrativo, no puntuación
        </small>
        <small className="city-network-note">
          La ciudad depende de:{" "}
          {DEPARTMENTS.map((service) => service.name).join(", ")}.
        </small>
      </div>
    </section>
  );
}
