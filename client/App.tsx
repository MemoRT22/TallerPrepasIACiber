import { Shell, ErrorNote } from "./components/UI";
import { useGame } from "./useGame";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Player from "./pages/Player";
import Guide from "./pages/Guide";

function Monitor({ code }: { code?: string }) {
  const game = useGame("public", code);
  return (
    <Shell active="monitor" connected={game.connected} room={code}>
      <ErrorNote error={game.error} close={() => game.setError("")} />
      {code && !game.snapshot ? (
        <main className="page-container">
          <div className="panel waiting-card">
            <h1>Conectando con la ciudad…</h1>
            <p>Espera a que el administrador prepare la experiencia.</p>
          </div>
        </main>
      ) : (
        <Dashboard state={game.snapshot?.public} demo={!code} />
      )}
    </Shell>
  );
}
function AdminRoute() {
  const game = useGame("admin");
  return (
    <Shell
      active="admin"
      connected={game.connected}
      room={game.snapshot?.public.code}
    >
      <Admin game={game} />
    </Shell>
  );
}
function PlayerRoute({ code, slot }: { code?: string; slot?: number }) {
  const requestedCode =
    code || new URLSearchParams(location.search).get("code") || undefined;
  const game = useGame("player", requestedCode, slot);
  return (
    <Shell
      active="player"
      connected={game.connected}
      room={game.snapshot?.public.code}
    >
      <Player game={game} code={code} slot={slot} />
    </Shell>
  );
}
function GuideRoute() {
  const game = useGame("admin");
  if (!game.canCreate)
    return (
      <Shell active="monitor">
        <main className="simple-player">
          <section className="panel terminal-finish">
            <h1>Guía del administrador</h1>
            <p>
              Este contenido se consulta desde el acceso privado de
              administrador.
            </p>
          </section>
        </main>
      </Shell>
    );
  return (
    <Shell active="guide" connected={game.connected}>
      <Guide />
    </Shell>
  );
}
export default function App() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  const publicMatch = path.match(/^\/pantalla\/(\d{4})$/);
  const playerMatch = path.match(/^\/jugar\/(\d{4})\/([1-6])$/);
  if (path === "/") return <Monitor />;
  if (publicMatch) return <Monitor code={publicMatch[1]} />;
  if (path === "/docente") return <AdminRoute />;
  if (path === "/jugar") return <PlayerRoute />;
  if (playerMatch)
    return <PlayerRoute code={playerMatch[1]} slot={Number(playerMatch[2])} />;
  if (path === "/guia") return <GuideRoute />;
  return (
    <Shell>
      <main className="page-container">
        <section className="panel waiting-card">
          <h1>Esta terminal no existe.</h1>
          <p>Revisa la liga o regresa al centro de operaciones.</p>
          <a href="/" className="btn primary">
            Volver al inicio
          </a>
        </section>
      </main>
    </Shell>
  );
}
