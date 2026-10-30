import type { AdminState, PublicState } from "../../shared/types";
import { teacherDebrief } from "../teacherDebrief";

export default function TeacherDebrief({
  state,
  admin,
  connected,
}: {
  state: PublicState;
  admin: AdminState;
  connected: boolean;
}) {
  const debrief = connected ? teacherDebrief(state, admin) : null;
  if (!debrief) return null;
  return (
    <details
      className="panel teacher-debrief"
      key={`${state.code}:${state.roundId}`}
    >
      <summary>CIERRE DOCENTE — ¿QUÉ APRENDIMOS?</summary>
      <p className="teacher-debrief-private">
        Material privado · no proyectar. Conversación de 2–3 minutos.
      </p>
      <p>{debrief.outcome}. El resultado no sustituye la reflexión.</p>
      <ol>
        {debrief.questions.map((item) => (
          <li key={item.question}>
            <h3>{item.question}</h3>
            <p className="teacher-debrief-evidence">
              <b>
                {item.evidence
                  ? "Hecho registrado"
                  : "Sin evidencia específica"}
                :{" "}
              </b>
              {item.evidence ??
                "No consta un hecho verificable en el registro disponible; no significa que no haya ocurrido."}
            </p>
            <p>
              <b>
                {item.evidence
                  ? "Aprendizaje sugerido"
                  : "Recomendación general"}
                :{" "}
              </b>
              {item.suggestion}
            </p>
          </li>
        ))}
      </ol>
      <small>
        Las consultas registran una solicitud, no prueban que se leyó la
        evidencia ni que la decisión posterior fue correcta.
      </small>
    </details>
  );
}
