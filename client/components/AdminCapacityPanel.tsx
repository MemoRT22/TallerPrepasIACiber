import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Users } from "lucide-react";
import type { GameConnection } from "../useGame";

export default function AdminCapacityPanel({ game }: { game: GameConnection }) {
  const state = game.snapshot?.public;
  const [draft, setDraft] = useState(state?.capacity ?? 6);
  const [confirmNext, setConfirmNext] = useState(false);
  const locked =
    !!state &&
    (state.capacityLocked === true ||
      (state.assigned && state.phase !== "revealed"));
  const finished = state?.phase === "revealed";
  const unavailable = locked || game.busy || !game.connected;
  const confirmed =
    !!state && state.autoStart && draft === state.capacity && !finished;

  useEffect(() => {
    if (state) setDraft(state.capacity);
    if (locked) setConfirmNext(false);
  }, [state?.code, state?.capacity, locked]);

  async function apply() {
    if (unavailable) return;
    const result = state
      ? await game.request("admin", {
          eventId: crypto.randomUUID(),
          command: "capacity",
          capacity: draft,
        })
      : await game.request("create", { capacity: draft, autoStart: true });
    if (result.ok) setConfirmNext(false);
  }

  return (
    <section
      className={`panel admin-capacity-panel ${locked ? "is-locked" : ""}`}
      aria-labelledby="capacity-title"
    >
      <div className="capacity-heading">
        <div>
          <span className="eyebrow">TU GRUPO</span>
          <h2 id="capacity-title">Cantidad de jugadores</h2>
        </div>
        <span className="capacity-state">
          {locked ? <LockKeyhole size={18} /> : <Users size={18} />}
          {locked
            ? "Bloqueada durante la actividad"
            : finished
              ? "Lista para el siguiente grupo"
              : "Elige de 3 a 6"}
        </span>
      </div>
      <div
        className="simple-capacity"
        role="group"
        aria-label="Cantidad de jugadores"
        aria-describedby="capacity-explanation"
      >
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} jugadores`}
            aria-pressed={draft === n}
            disabled={unavailable}
            className={draft === n ? "selected" : ""}
            onClick={() => {
              if (!unavailable) setDraft(n);
            }}
          >
            <Users size={20} />
            <b>{n}</b>
          </button>
        ))}
      </div>
      <p className="help-text" id="capacity-explanation">
        {locked
          ? "La cantidad no cambia mientras juegan, aunque pauses. Podrás elegir otra cuando termine la votación y se revele al impostor."
          : finished
            ? "Elige cuántos jugarán después. Preparar el siguiente grupo reinicia esta misma sala y conserva tus ligas."
            : "No hay límite de tiempo. Confirma la cantidad para mostrar el QR en la ciudad; cuando se conecte todo el grupo, comenzará la actividad."}
      </p>
      {!locked && (
        <button
          className="btn primary full"
          disabled={unavailable || confirmed}
          onClick={() => {
            if (finished) setConfirmNext(true);
            else void apply();
          }}
        >
          {finished
            ? "Preparar siguiente grupo"
            : confirmed
              ? `${state!.capacity} jugadores confirmados · QR listo`
              : state
                ? "Confirmar jugadores y mostrar QR"
                : "Confirmar cantidad y crear experiencia"}
          <ArrowRight size={18} />
        </button>
      )}
      {confirmNext && (
        <div
          className="admin-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="capacity-confirm-title"
          aria-describedby="capacity-confirm-description"
        >
          <div>
            <h2 id="capacity-confirm-title">
              ¿Preparar otro grupo de {draft} jugadores?
            </h2>
            <p id="capacity-confirm-description">
              Se cerrarán las terminales del grupo anterior y se borrarán sus
              nombres, roles, puntos, votos y registro. Esta limpieza no se
              puede deshacer. Conservas esta misma sala, tu acceso, la pantalla,
              las ligas y los parámetros. Descarga el registro antes si
              necesitas guardarlo.
            </p>
            <div>
              <button
                className="btn secondary"
                onClick={() => setConfirmNext(false)}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                disabled={unavailable}
                onClick={() => void apply()}
              >
                Confirmar siguiente grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
