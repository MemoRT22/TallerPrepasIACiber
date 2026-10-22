import { useState } from "react";
import type { GameConnection } from "../useGame";

export default function AdminAccess({ game }: { game: GameConnection }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel admin-create">
      <h2>Acceso de administrador</h2>
      <p>
        Para entrar necesitas el enlace privado completo. Pega aquí el que te
        compartieron, incluida la parte que comienza con #.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setBusy(true);
          try {
            const result = await game.openAdminLink(link);
            if (result.ok) setLink("");
            else setError(result.error || "No se pudo abrir el acceso.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Enlace privado completo
          <input
            type="password"
            value={link}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            onChange={(event) => setLink(event.target.value)}
            onInput={(event) => setLink(event.currentTarget.value)}
            placeholder="Pega el enlace original del administrador"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          className="btn primary full"
          type="submit"
          disabled={busy || !link.trim()}
        >
          {busy ? "Abriendo acceso…" : "Abrir panel"}
        </button>
      </form>
      <p className="help-text">
        Usa el enlace original, no la dirección copiada después de abrirlo. No
        se crea ni inicia una actividad al pegarlo.
      </p>
    </section>
  );
}
