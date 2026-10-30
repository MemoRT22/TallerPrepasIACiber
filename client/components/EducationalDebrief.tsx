import type {
  EducationalDebrief as Debrief,
  PublicState,
} from "../../shared/types";

export default function EducationalDebrief({
  state,
  debrief,
}: {
  state: PublicState;
  debrief?: Debrief;
}) {
  if (
    !debrief ||
    state.stage !== "finished" ||
    state.roundId !== debrief.roundId ||
    state.phase !== debrief.phase
  )
    return null;
  return (
    <section
      className="educational-debrief"
      aria-label="Análisis de tu decisión"
    >
      <h3>ANÁLISIS DE TU DECISIÓN</h3>
      {debrief.kind === "observed" ? (
        <dl>
          <div>
            <dt>LO QUE HICISTE</dt>
            <dd>{debrief.decision}</dd>
          </div>
          <div>
            <dt>LA EVIDENCIA</dt>
            <dd>{debrief.evidence}</dd>
          </div>
          <div>
            <dt>LA CONSECUENCIA</dt>
            <dd>{debrief.consequence}</dd>
          </div>
          <div>
            <dt>APRENDIZAJE</dt>
            <dd>{debrief.learning}</dd>
          </div>
        </dl>
      ) : (
        <>
          <p className="educational-empty">
            SIN UNA DECISIÓN DESTACADA REGISTRADA
          </p>
          <p>
            <b>Recomendación general: </b>
            {debrief.learning}
          </p>
        </>
      )}
    </section>
  );
}
