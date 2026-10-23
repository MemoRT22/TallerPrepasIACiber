import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Audio opcional y pregrabado del comunicado. Reglas:
 * - Apagado por defecto y sin reproducción automática: solo suena tras pulsar
 *   «Activar audio».
 * - «Silenciar» detiene la reproducción al instante.
 * - No se pide nada fuera del origen local y, si el archivo no existe, el
 *   control ni siquiera aparece: la transcripción visible basta para jugar.
 */
export async function probeAudio(
  src: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(src, { method: "HEAD" });
    const type = response.headers.get("content-type") ?? "";
    return response.ok && type.startsWith("audio/");
  } catch {
    return false;
  }
}

export default function SyntheticVoice({ src }: { src: string }) {
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void probeAudio(src).then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
      audio.current?.pause();
      audio.current = null;
    };
  }, [src]);

  const stop = () => {
    const element = audio.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    setPlaying(false);
  };

  const start = () => {
    setFailed(false);
    const element = audio.current ?? new Audio(src);
    audio.current = element;
    element.preload = "none";
    element.onended = () => setPlaying(false);
    element.onerror = () => {
      setPlaying(false);
      setFailed(true);
    };
    void element
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        setFailed(true);
      });
  };

  if (!available) return null;
  return (
    <div className="synthetic-voice">
      {playing ? (
        <button type="button" className="btn secondary" onClick={stop}>
          <VolumeX size={16} /> Silenciar
        </button>
      ) : (
        <button type="button" className="btn secondary" onClick={start}>
          <Volume2 size={16} /> Activar audio
        </button>
      )}
      {failed && (
        <small role="status">Audio no disponible. Lee la transcripción.</small>
      )}
    </div>
  );
}
