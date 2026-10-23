# Auditoría final de P4

Fecha: 23 de octubre de 2026. Rama: `claude/p4-identidad-robada-ia-91c1a4`.
Base comprobada: `9da4f351364a1d087fcc8fe9ec256071fc8e1636` (`origin/main`).
Se auditó la implementación `82f5422` y la corrección previa `42ace04`.

## Veredicto

Lista para revisión técnica final. No se encontraron bloqueantes pendientes
tras las correcciones descritas abajo. El impacto pedagógico, la comprensión
del briefing y el balance con alumnos siguen pendientes de pilotaje humano.

## Funcionalidades comprobadas

- Catálogo de ocho personas ficticias con retratos SVG locales, datos de
  credencial comparables y evidencia de un registro simulado.
- Dos verificaciones por jugador, validadas en servidor, con espera lógica de
  1,5 s. Durante la consulta no se puede decidir; las ventanas de 10/8/6 s
  conservan un margen de respuesta. No se gastan usos por tarjetas expiradas
  ni se transfiere evidencia a una nueva tarjeta.
- Expediente exclusivo del impostor, reintento limitado y desbloqueo de una
  sola suplantación avanzada. Se comprueban rol, fase, cooldown y defensores
  activos; la inyección mantiene la tarjeta activa y las pendientes protegidas.
- Comunicado institucional de 14 s, transcripción, tarjeta visualmente
  coincidente pero contradictoria con el registro y cierre explicativo privado.
- Snapshots públicos sin expediente, respuesta, origen ni clasificación de
  tarjetas; alerta agregada en el pulso público.
- Pausa, reanudación, desconexión/reincorporación, deduplicación, reinicio y
  limpieza al pasar a Recuperación. Reincorporarse durante la ronda sigue
  esperando a la siguiente misión, como antes de P4.
- Cupos 3–6 y duraciones de identidad de 30, 31, 45, 60, 90, 120, 300 y 600 s.
  Las colas permanecen limitadas a dos pendientes; el log conserva su límite
  preexistente de 2.000 entradas.
- P0–P3 continúan pasando; no se cambiaron dependencias, otras misiones ni P5–P8.

## Problemas encontrados y correcciones

1. El hilo automático de la PR #5 identificó que una tarjeta del comunicado
   aún activa se describía como nunca recibida al terminar anticipadamente.
   El cierre ahora registra `unanswered`, conserva el hallazgo y distingue una
   consulta completada de otra pendiente, sin alterar decisiones ni puntajes.
2. Verificar comprobaba únicamente la expiración de la tarjeta, que puede
   superar el final de la misión. Ahora servidor e interfaz exigen al menos
   tres segundos antes del menor de ambos plazos; se cubren los bordes de
   2.999 y 3.000 ms. La expiración tampoco afirma haber recibido evidencia
   si la consulta no llegó a completarse.

## Validación ejecutada

Secuencia final: `pnpm check` PASS, `pnpm test` PASS (165/165; 43 de P4),
`pnpm build` PASS. Permanece la advertencia preexistente de `CityViewport`
(565,11 kB; gzip 146,62 kB).

Recorrido del build de producción con reloj de prueba local y tres terminales:
defensor, impostor, público y docente. Se comprobaron consulta/espera/evidencia,
pausa, expediente y suplantación única, comunicado sin archivo de audio,
cierre con comunicado activo y registro consultado, y llegada a Recuperación.
Sin errores de consola en defensor, impostor y pantalla pública.

La revisión móvil efectiva se realizó en Brave a 320×640 y 390×844. No hubo
desbordamiento horizontal; en 320 px los tres botones midieron aproximadamente
81×67 px y siguieron alcanzables al consultar el registro. El intento de
cambiar viewport del navegador integrado no se contó como evidencia móvil,
porque siguió reportando 1280×720.

## Activos, audio y experiencia

No hay fotos reales, retratos generados por IA aprobados ni audio incluido.
Los SVG son ilustraciones propias del código; no se presentan como IA. No hay
modelos, APIs de generación ni detección de IA en vivo. La procedencia y el
procedimiento para incorporar futuros recursos autorizados están documentados
en `P4_IDENTIDADES_Y_ACTIVOS.md`.

La misión funciona sin multimedia opcional. Las pruebas del reproductor
simulado comprueban ausencia de autoplay, activación explícita, Silenciar y
detención al desmontar. La reproducción con una grabación real y su
consentimiento no se ha probado porque no se entregó un archivo autorizado.

El momento narrativo añade una decisión engañosa, evidencia posterior y una
explicación de la llamada; tiene más contenido pedagógico que una alerta
aislada. Su capacidad para resultar memorable no se puede certificar sin
alumnos. También requieren pilotaje la lectura en 20 s, las diferencias
tipográficas sutiles y la presión de las ventanas de 6 s en teléfonos físicos.

La auditoría no fusiona ni despliega la rama.
