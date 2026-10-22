import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Users } from "lucide-react";

export function showJoinQR(
  state: {
    code: string;
    phase: string;
    assigned: boolean;
    autoStart?: boolean;
  },
  demo = false,
) {
  return (
    !demo &&
    state.autoStart === true &&
    /^\d{4}$/.test(state.code) &&
    state.phase === "lobby" &&
    !state.assigned
  );
}

export default function JoinQR({
  code,
  connected,
  capacity,
  automatic,
}: {
  code: string;
  connected: number;
  capacity: number;
  automatic?: boolean;
}) {
  const [qr, setQr] = useState("");
  const [failed, setFailed] = useState(false);
  const path = `/jugar?code=${encodeURIComponent(code)}`;
  useEffect(() => {
    let active = true;
    setQr("");
    setFailed(false);
    void QRCode.toDataURL(`${location.origin}${path}`, {
      width: 768,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#123e70", light: "#ffffff" },
    })
      .then((image) => {
        if (active) setQr(image);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <aside
      className="city-join-qr"
      aria-label="QR para unirse a la experiencia"
    >
      <span className="eyebrow">
        <QrCode size={17} />
        ÚNETE AL EQUIPO
      </span>
      <h2>Escanea y entra</h2>
      <p>Abre la cámara de tu celular y escribe tu nombre.</p>
      <div className="city-qr-image">
        {qr ? (
          <img
            src={qr}
            alt={`QR de acceso a la sala ${code}`}
            width={280}
            height={280}
          />
        ) : (
          <div role="status">
            {failed ? "Usa el código de acceso de abajo." : "Preparando QR…"}
          </div>
        )}
      </div>
      <div className="city-join-code">
        <span>CÓDIGO DE ACCESO</span>
        <strong>{code}</strong>
      </div>
      <a className="city-join-address" href={path}>
        Abrir terminal de juego
      </a>
      <div className="city-join-progress" role="status" aria-live="polite">
        <Users size={20} />
        <b>
          {connected} / {capacity}
        </b>
        <span>conectados</span>
      </div>
      <p className="city-join-next">
        {automatic
          ? "Cuando esté todo el equipo, el QR se ocultará y aparecerán las instrucciones."
          : "El administrador dará la señal cuando el equipo esté listo."}
      </p>
    </aside>
  );
}
