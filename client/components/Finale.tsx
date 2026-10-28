import type { PublicState } from "../../shared/types";
import { Scores } from "./UI";

export function FinalScoreboard({
  state,
  compact = false,
}: {
  state: PublicState;
  compact?: boolean;
}) {
  const rows = [
    { phase: "mail", label: "Correos" },
    { phase: "ddos", label: "DDoS" },
    { phase: "identity", label: "Identidad" },
    { phase: "recovery", label: "Bonus de Recuperación" },
    { phase: "voting", label: "Bonus de identificación" },
  ];
  return (
    <section
      className="final-scoreboard"
      aria-label="Marcador final desglosado"
    >
      <h3>Cada misión cuenta</h3>
      <Scores state={state} />
      <details key={compact ? "summary" : "full"} open={!compact}>
        <summary>Desglose de los cinco resultados</summary>
        <table>
          <thead>
            <tr>
              <th>Resultado</th>
              <th>Equipo</th>
              <th>Impostor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const result = state.results.find((r) => r.phase === row.phase);
              return (
                <tr key={row.phase}>
                  <th scope="row">
                    {row.label}
                    {!result || result.winner === "inconclusive" ? (
                      <small>
                        Sin punto ·{" "}
                        {result ? "inconclusa o interrumpida" : "no adjudicado"}
                      </small>
                    ) : null}
                  </th>
                  <td>{result?.winner === "defenders" ? "+1" : "—"}</td>
                  <td>{result?.winner === "impostor" ? "+1" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
      <small>La estabilidad de la ciudad es narrativa: no suma puntos.</small>
    </section>
  );
}

export default function Finale({ state }: { state: PublicState }) {
  const reveal = state.reveal;
  const step = state.judgment?.step ?? "learning";
  if (!reveal)
    return step === "truth" ? (
      <section className="finale finale-truth" aria-label="Desenlace de Cancún">
        <span className="eyebrow">EL JUICIO FINAL · SIMULACIÓN</span>
        <h2>El momento de la verdad</h2>
        <p>
          La ciudad conserva las consecuencias de sus decisiones. La identidad
          se revela en unos segundos.
        </p>
        <p className="final-progress" role="status">
          1 / 4 · Secuencia automática · no necesitas tocar nada
        </p>
      </section>
    ) : null;
  const result = step === "result" || step === "learning";
  return (
    <section
      className={`finale finale-${step}`}
      aria-label="Desenlace de Cancún"
    >
      <span className="eyebrow">EL JUICIO FINAL · SIMULACIÓN</span>
      <h2>
        {step === "truth"
          ? "El momento de la verdad"
          : step === "identity"
            ? "El impostor estaba entre nosotros"
            : reveal.winner === "tie"
              ? "EMPATE FINAL"
              : reveal.winner === "defenders"
                ? "CANCÚN RESISTIÓ · GANÓ EL EQUIPO"
                : "EL IMPOSTOR GANÓ LA PARTIDA"}
      </h2>
      {step === "truth" ? (
        <p>
          La ciudad conserva las consecuencias de sus decisiones. La identidad
          se revela en unos segundos.
        </p>
      ) : (
        <p className="final-identity">
          <strong>{reveal.impostorName}</strong> · Responsable de{" "}
          {reveal.impostorDepartment}
        </p>
      )}
      {result && (
        <>
          <FinalScoreboard state={state} compact={step === "learning"} />
          {reveal.bonus && (
            <p>
              Identificación: {reveal.bonus.correct} de {reveal.bonus.eligible}{" "}
              defensores elegibles acertaron. Mayoría necesaria:{" "}
              {reveal.bonus.required}. Bonus para{" "}
              {reveal.bonus.winner === "defenders"
                ? "el equipo"
                : "el impostor"}
              .
            </p>
          )}
        </>
      )}
      {step === "learning" && (
        <div className="final-reflection">
          <h3>Lo que nos llevamos</h3>
          <p>
            {reveal.reflection?.success ??
              "Una decisión acertada es verificar por un canal independiente."}
          </p>
          <p>
            {reveal.reflection?.vulnerability ??
              "Vulnerabilidad a prevenir: confiar solo en la apariencia."}
          </p>
          <p>
            {reveal.reflection?.recommendation ??
              "Verifica información, decide con evidencia y trabaja en equipo. Esta experiencia fue una simulación."}
          </p>
          <blockquote>
            La ciberseguridad también implica verificar información, tomar
            decisiones bajo presión y trabajar en equipo.
          </blockquote>
        </div>
      )}
      {state.judgment && (
        <p className="final-progress" role="status">
          {["truth", "identity", "result", "learning"].indexOf(step) + 1} / 4 ·{" "}
          {state.judgment.elapsed < 30
            ? "Secuencia automática · no necesitas tocar nada"
            : "Secuencia completa · reflexión y cierre"}
        </p>
      )}
    </section>
  );
}
