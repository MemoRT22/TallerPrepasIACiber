import type { PublicState } from "../../shared/types";

/** Presentation only: public facts, never scores/stability as a recovery verdict. */
export function restorationOutcome(state: PublicState) {
  const result = state.results.find((r) => r.phase === "recovery");
  if (result?.winner === "inconclusive") return "interrupted";
  if (
    state.recovery.done &&
    state.recovery.total > 0 &&
    state.recovery.completed === state.recovery.total
  )
    return "complete";
  if (result?.winner === "impostor") return "incomplete";
  return "pending";
}

export function RestorationProgress({ state }: { state: PublicState }) {
  const { completed, total } = state.recovery;
  const percent = total ? Math.round((100 * completed) / total) : 0;
  return (
    <section
      className="restoration-protocol"
      aria-label="Protocolo de restauración"
    >
      <div className="protocol-heading">
        <span className="eyebrow">PROTOCOLO DE RESTAURACIÓN</span>
        <strong>{percent}%</strong>
      </div>
      <ol
        className="protocol-modules"
        aria-label="Módulos anónimos del protocolo"
      >
        {Array.from({ length: total }, (_, index) => (
          <li
            key={`${state.roundId}:${index}`}
            className={index < completed ? "validated" : "pending"}
          >
            <span aria-hidden="true">{index < completed ? "✓" : "◇"}</span>
            <b>Módulo {index + 1}</b>
            <small>{index < completed ? "RECUPERADO" : "PENDIENTE"}</small>
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" aria-atomic="true">
        {completed} / {total} partes validadas
        {completed > 0
          ? " · fragmentos autenticados"
          : " · esperando fragmentos"}
      </p>
      <progress
        value={completed}
        max={total || 1}
        aria-label="Reconstrucción del protocolo"
      />
    </section>
  );
}

export function RestorationOutcome({ state }: { state: PublicState }) {
  const outcome = restorationOutcome(state);
  return (
    <section
      className={`restoration-outcome ${outcome}`}
      aria-label="Estado operativo de Cancún"
    >
      <span className="eyebrow">ESTADO DE CANCÚN · OBJETIVO OPERATIVO</span>
      <h3>
        {outcome === "complete"
          ? "Protocolo completamente restaurado"
          : outcome === "incomplete"
            ? "Restauración incompleta"
            : outcome === "interrupted"
              ? "Restauración interrumpida"
              : "Protocolo sin cierre confirmado"}
      </h3>
      <p>
        {outcome === "complete"
          ? "Todos los fragmentos fueron validados. Cancún recuperó su capacidad operativa."
          : outcome === "incomplete"
            ? "Quedaron fragmentos pendientes al vencer el tiempo. El protocolo permanece parcialmente comprometido."
            : outcome === "interrupted"
              ? "El docente interrumpió la operación. No se declara restauración completa ni se adjudica un punto de Recuperación."
              : "Las partes validadas muestran el avance real; todavía no hay una restauración completa confirmada."}
      </p>
      <small>
        {state.recovery.completed} / {state.recovery.total} partes validadas.
        {state.city
          ? ` Estabilidad narrativa: ${state.city.stability}/100; no es puntuación.`
          : ""}
      </small>
    </section>
  );
}

export function RestorationMoment({ state }: { state: PublicState }) {
  const complete = restorationOutcome(state) === "complete";
  return (
    <section
      className={`restoration-moment ${complete ? "restoration-success" : ""} ${state.paused ? "is-paused" : ""}`}
      aria-label="Cierre operativo de la restauración"
    >
      {complete ? (
        <>
          <div className="restoration-beat beat-protocol" aria-hidden="true">
            <span className="eyebrow">PROTOCOLO RECONSTRUIDO</span>
            <h2>Todos los fragmentos han sido validados.</h2>
          </div>
          <div className="restoration-beat beat-city" aria-hidden="true">
            <span className="eyebrow">INFRAESTRUCTURA RESTABLECIDA</span>
            <h2>Cancún recupera su capacidad operativa.</h2>
          </div>
          <div className="restoration-beat beat-twist">
            <span className="eyebrow">CANCÚN HA SIDO RESTAURADO.</span>
            <h2>Pero el responsable del ataque sigue entre nosotros.</h2>
            <p>
              Protocolo reconstruido · todos los fragmentos validados. Recuperar
              la ciudad no significa haber ganado la partida.
            </p>
          </div>
        </>
      ) : (
        <RestorationOutcome state={state} />
      )}
    </section>
  );
}

export function JudgmentTransition({ state }: { state: PublicState }) {
  const outcome = restorationOutcome(state);
  return (
    <p className="judgment-transition">
      {outcome === "complete"
        ? "La ciudad ha completado su restauración."
        : outcome === "incomplete"
          ? "La respuesta de emergencia terminó con el protocolo incompleto."
          : outcome === "interrupted"
            ? "La respuesta de emergencia fue interrumpida."
            : "La respuesta de emergencia ha terminado."}{" "}
      Ahora debemos identificar al responsable de los ataques desde dentro del
      equipo.
    </p>
  );
}

export function strategicExplanation(state: PublicState) {
  const complete = restorationOutcome(state) === "complete";
  const winner = state.reveal?.winner;
  if (winner === "tie")
    return "Los puntos están equilibrados, independientemente del estado operativo de la ciudad.";
  if (winner === "defenders")
    return complete
      ? "El equipo restauró los servicios y ganó por puntos frente al atacante."
      : "El equipo ganó por puntos al contener suficientes amenazas; eso no convierte en completa la restauración.";
  return complete
    ? "Los servicios fueron recuperados, pero el atacante acumuló ventajas decisivas durante la crisis y ganó por puntos."
    : "El atacante ganó por puntos. La restauración no quedó completada; ambos resultados se muestran por separado.";
}
