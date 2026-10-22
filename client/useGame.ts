import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  parseAdminLink,
  readAdminFragment,
  rememberAdminLink,
  removeAdminFragment,
  retainAdminFragment,
} from "./adminLink";
import type {
  Ack,
  AdminCommand,
  GameAction,
  Session,
  Settings,
  Snapshot,
} from "../shared/types";

function saveSession(key: string, session: Session) {
  try {
    localStorage.setItem(key, JSON.stringify(session));
  } catch {
    /* La conexión mantiene el token en memoria. */
  }
}

export function useGame(
  kind: "admin" | "player" | "public",
  code?: string,
  slot?: number,
) {
  const key = `cancun:${kind}:${kind === "admin" ? "session" : `${code || "manual"}:${slot || ""}`}`;
  const initial = useRef<Session | null>(null);
  const initialized = useRef(false);
  const operatorKey = useRef<string | null>(null);
  if (!initialized.current) {
    initialized.current = true;
    const hash = new URLSearchParams(location.hash.slice(1));
    if (kind === "admin") {
      try {
        operatorKey.current =
          hash.get("access") || sessionStorage.getItem("cancun:operator");
        if (operatorKey.current)
          sessionStorage.setItem("cancun:operator", operatorKey.current);
      } catch {
        operatorKey.current = hash.get("access");
      }
    }
    if (kind === "admin" && hash.get("token") && hash.get("room")) {
      initial.current = {
        code: hash.get("room")!,
        token: hash.get("token")!,
        kind: "admin",
      };
      saveSession(key, initial.current);
    } else {
      try {
        initial.current = JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        initial.current = null;
      }
    }
  }
  const [session, setSession] = useState<Session | null>(initial.current);
  const sessionRef = useRef(session);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(false);
  const [, setAccessRevision] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (kind !== "admin") return;
    const link = readAdminFragment(location.hash);
    if (link && rememberAdminLink(link)) removeAdminFragment();
  }, [kind]);

  const endPlayerSession = useCallback(
    (roomCode: string) => {
      if (kind !== "player") return;
      try {
        localStorage.removeItem(key);
      } catch {
        /* El token en memoria también se descarta. */
      }
      sessionRef.current = null;
      setSession(null);
      setSnapshot(null);
      readyRef.current = false;
      socketRef.current?.disconnect();
      location.replace(`/jugar?code=${encodeURIComponent(roomCode)}&reset=1`);
    },
    [kind, key],
  );

  const consume = useCallback(
    (result: Ack) => {
      if (!result.ok) {
        if (result.errorCode === "session_revoked" && kind === "player") {
          endPlayerSession(sessionRef.current?.code || code || "");
          return result;
        }
        setError(result.error || "No se pudo completar la acción.");
        return result;
      }
      if (result.session) {
        sessionRef.current = result.session;
        setSession(result.session);
        saveSession(key, result.session);
      }
      if (result.snapshot) setSnapshot(result.snapshot);
      return result;
    },
    [key, kind, code, endPlayerSession],
  );

  useEffect(() => {
    const socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;
    socket.on("state", (state: Snapshot) => setSnapshot(state));
    socket.on("session:ended", (event: { code: string; reason: string }) => {
      if (
        event.reason === "activity_reset" &&
        event.code === sessionRef.current?.code
      )
        endPlayerSession(event.code);
    });
    socket.on("connect", () => {
      readyRef.current = false;
      setConnected(false);
      setError("");
      const restore = (result: Ack) => {
        if (!result.ok && kind === "admin" && operatorKey.current) {
          // El acceso único sigue válido aunque la sala temporal ya no exista.
          try {
            localStorage.removeItem(key);
          } catch {
            /* Almacenamiento opcional. */
          }
          sessionRef.current = null;
          setSession(null);
          setSnapshot(null);
          setError(
            "La sala anterior ya no está disponible. Elige la cantidad para preparar un nuevo grupo.",
          );
          readyRef.current = true;
          setConnected(true);
          return;
        }
        consume(result);
        readyRef.current = result.ok;
        setConnected(result.ok);
        if (result.ok) setLeft(false);
      };
      if (sessionRef.current)
        socket.emit("resume", sessionRef.current, restore);
      else if (kind === "public" && code)
        socket.emit("watch", { code }, restore);
      else {
        readyRef.current = true;
        setConnected(true);
      }
    });
    socket.on("disconnect", (reason) => {
      readyRef.current = false;
      setConnected(false);
      if (reason === "io server disconnect")
        setError(
          "Esta sesión se abrió en otro dispositivo. Usa tu enlace privado para recuperar el acceso.",
        );
    });
    socket.on("connect_error", () => {
      setConnected(false);
      setError("Sin conexión con el servidor. Intentando reconectar…");
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [kind, code, consume, endPlayerSession]);

  const request = useCallback(
    async (event: string, payload: unknown): Promise<Ack> => {
      if ((event === "create" || event === "admin") && kind !== "admin")
        return {
          ok: false,
          error: "Solo el administrador puede realizar esta acción.",
        };
      if ((event === "join" || event === "action") && kind !== "player")
        return {
          ok: false,
          error: "Esta vista no es una terminal de jugador.",
        };
      if (event === "create" && !operatorKey.current && !sessionRef.current)
        return {
          ok: false,
          error: "Necesitas tu enlace privado de administrador.",
        };
      const socket = socketRef.current;
      if (!socket?.connected || !readyRef.current) {
        setError("Espera a que se restablezca la conexión.");
        return { ok: false };
      }
      setBusy(true);
      setError("");
      try {
        const result = (await socket
          .timeout(6000)
          .emitWithAck(
            event,
            event === "create"
              ? { ...(payload as object), adminKey: operatorKey.current }
              : payload,
          )) as Ack;
        return consume(result);
      } catch {
        setError(
          "El servidor no respondió. No repitas la acción hasta reconectar.",
        );
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [consume, kind],
  );
  const openAdminLink = useCallback(
    async (value: string): Promise<Ack> => {
      if (kind !== "admin")
        return {
          ok: false,
          error: "Esta vista no es un panel de administrador.",
        };
      const link = parseAdminLink(value, location.origin);
      if (!link)
        return {
          ok: false,
          error:
            "Pega el enlace original completo del administrador, incluida su clave después de #. La dirección /docente sola no incluye permisos.",
        };
      if ("access" in link) {
        operatorKey.current = link.access;
        if (!rememberAdminLink(link)) retainAdminFragment(link);
        if (!snapshot?.admin && sessionRef.current) {
          try {
            localStorage.removeItem(key);
          } catch {
            /* Almacenamiento opcional. */
          }
          sessionRef.current = null;
          setSession(null);
          setSnapshot(null);
          readyRef.current = socketRef.current?.connected === true;
          setConnected(readyRef.current);
        }
        setAccessRevision((n) => n + 1);
        setError("");
        return { ok: true };
      }
      const result = await request("resume", link.session);
      if (result.ok && !rememberAdminLink(link)) retainAdminFragment(link);
      return result;
    },
    [kind, request, key, snapshot?.admin],
  );

  useEffect(() => {
    if (kind !== "admin") return;
    const incoming = () => {
      if (readAdminFragment(location.hash)) void openAdminLink(location.href);
    };
    window.addEventListener("hashchange", incoming);
    return () => window.removeEventListener("hashchange", incoming);
  }, [kind, openAdminLink]);

  const admin = (command: AdminCommand, settings?: Settings) =>
    request("admin", { eventId: crypto.randomUUID(), command, settings });
  const act = (action: Omit<GameAction, "eventId">) =>
    request("action", { ...action, eventId: crypto.randomUUID() });
  const leave = () => {
    if (kind !== "player") return;
    if (sessionRef.current) saveSession(key, sessionRef.current);
    readyRef.current = false;
    socketRef.current?.disconnect();
    setConnected(false);
    setError("");
    setLeft(true);
  };
  const reconnect = () => {
    if (kind !== "player") return;
    setError("");
    socketRef.current?.connect();
  };
  const forget = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* No hay almacenamiento disponible. */
    }
    if (kind === "admin") {
      operatorKey.current = null;
      try {
        sessionStorage.removeItem("cancun:operator");
      } catch {
        /* Puede estar bloqueado en el iframe. */
      }
    }
    socketRef.current?.disconnect();
    sessionRef.current = null;
    setSession(null);
    setSnapshot(null);
    location.assign(kind === "admin" ? "/docente" : "/jugar");
  };
  return {
    snapshot,
    session,
    connected,
    error,
    setError,
    busy,
    request,
    admin,
    act,
    forget,
    leave,
    reconnect,
    openAdminLink,
    left,
    canCreate:
      kind === "admin" && (!!operatorKey.current || session?.kind === "admin"),
  };
}
export type GameConnection = ReturnType<typeof useGame>;
