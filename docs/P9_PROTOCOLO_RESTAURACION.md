# P9 — Protocolo de Restauración y coherencia del desenlace

Implementación del 29 de octubre de 2026, desde main
`8e4626761010c389a114b41b311b49e7e16649b9`.
Rama: `feat/p9-protocolo-restauracion-narrativo`.

## Cambios de experiencia

- Briefing breve **MISIÓN 04 — RESTAURAR CANCÚN**: el protocolo está bloqueado,
  cada defensor conserva una autorización ficticia y debe descifrar/enviar su
  parte antes del límite. Advierte de la clave alterada y del carácter didáctico,
  inseguro para datos modernos, de César.
- El contador se convierte en **2–5 módulos anónimos**, derivados exclusivamente
  de `public.recovery.total/completed`. Cada parte validada ilumina un módulo,
  confirma su autenticación y actualiza el porcentaje y progress accesible.
  Son módulos de progreso agregado, sin correspondencia con jugadores, servicios
  u órdenes privados de fragmentos.
- El aviso público existente de sabotaje ahora dice **ANOMALÍA DETECTADA** y
  describe una alteración del protocolo sin identificar origen ni destinatario.
  El aviso personal, los candidatos de clave y la verificación permanecen privados.
- Al completar, una secuencia CSS de presentación muestra: protocolo reconstruido
  (0–1,6 s), infraestructura restablecida (1,6–3,2 s) y el giro narrativo desde
  3,2 s: **Cancún ha sido restaurado, pero el responsable sigue entre nosotros**.
  Un realce de la ciudad se extingue a 4,2 s. No bloquea controles ni añade una
  espera al docente: cambiar de fase puede interrumpir la presentación.
- La pantalla pública de Recuperación coloca la ciudad en la columna principal,
  con protocolo y narración al lado. En móvil se apila. Se reutilizan las luces,
  tránsito y servicios de Three.js que ya responden a la recuperación P6;
  solo se añaden realce CSS y un pulso ligero, sin geometrías ni dependencias.
- Timeout: **Restauración incompleta**, con avance real. Interrupción docente:
  **Restauración interrumpida**, sin declarar victoria/derrota ni restauración.
  El mensaje de la ciudad al finalizar sin completar deja de decir “en curso”.
- Debate y terminales conectan la respuesta de emergencia con la identificación
  del responsable. El resultado final presenta, en orden: identidad autorizada,
  **Estado de Cancún**, **Resultado de la partida por puntos**, cinco rubros y
  reflexión. Una ciudad restaurada puede acompañar una victoria del impostor.

## Autoridad y privacidad

`restorationOutcome` es una proyección pura de datos públicos, no un estado nuevo:
interrupción por resultado inconcluso; restauración por `done` y todas las partes;
incompleta por resultado de Recuperación para el impostor. No deriva recuperación
de estabilidad, de puntos ni de que un servicio aparezca en línea.

Los textos estratégicos usan `reveal.winner`, sin recalcular puntos ni afirmar
que el responsable evitó su identificación cuando el voto no lo demuestra.
Se prueban las cuatro combinaciones de recuperación/ganador y el empate.

No se tocaron `server/engine.ts`, `shared/types.ts` ni `shared/finalRules.ts`.
Permanecen idénticos: roles, 150/90/120/120 s, César +3→+5, un sabotaje,
verificación de 3 s, victorias, puntos, mayoría, elegibilidad, bonus,
revelación de 30 s, pausa/reconexión y snapshots privados.
En `shared/cityNarrative.ts` solo cambia el mensaje de cierre incompleto;
la fórmula, capítulos, estabilidad y estados de servicios no cambian.

Las animaciones no escriben estado ni emiten acciones. Se montan por ronda y
se descartan al reiniciar/cambiar de fase. No hay temporizadores JS adicionales.
Con movimiento reducido se omiten los pulsos y se muestra directamente la
confirmación con el giro, sin esperar la secuencia. Progreso, estado y cierre
son HTML accesible e independientes de WebGL; el fallback existente se conserva.

## Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm check` | PASS |
| `pnpm test` | PASS, 214/214, sin omitidas/canceladas |
| `pnpm build` | PASS; CityViewport conserva 566,35 kB, gzip 146,98 kB |
| `git diff --check` | PASS |
| Recuperación real del motor con 3/4/5/6 jugadores | PASS, 2/3/4/5 partes y deduplicación |
| Timeout, interrupción y repetición | PASS, sin cierre completo falso ni arrastre |
| Sabotaje, verificación, pausa y reconexión | PASS, conserva las reglas y rechaza acciones de reincorporación en la ronda |
| Combinaciones estratégicas, incluida estabilidad 100 con protocolo incompleto | PASS |
| Privacidad hasta 2.999 s y revelación desde 3.000 s | PASS |
| Efectos de ciudad y presentación sin alterar estado/puntos | PASS |
| Navegador escritorio, terminal 320×640 y briefing 390×844 | PASS en vistas revisadas; sin overflow horizontal, envío de 48 px |
| Teléfonos y proyector físicos para P9 | NO PROBADO; no se infiere de la revisión automatizada |

Incidencias de desarrollo: se corrigieron dos errores en la fixture nueva
(orden de argumentos de bind e inicio manual de la primera misión).
Una primera suite completa dio 213/214 porque el checkout nuevo aún no contenía
el archivo compilado que requiere el test de transporte (404); se generó el build
y se repitió en orden check/test/build/diff, con 214/214 aprobadas.
No se aumentaron timeouts ni se modificó el producto para ocultar estos fallos.

Capturas de componentes reales con **datos sintéticos claramente rotulados** en
una vista local aislada, no de la partida pública ni de teléfonos físicos:
se capturó la revisión visual; después se acortó el briefing y se denominó
“Módulo” a cada indicador anónimo, sin cambiar la composición.

- [Protocolo completo y ciudad](evidencias-p9/restauracion-completa.jpg).
- [Ciudad restaurada + victoria del impostor](evidencias-p9/restaurada-victoria-impostor.jpg).
- [Restauración incompleta](evidencias-p9/restauracion-incompleta.jpg).
- [Terminal a 320 px](evidencias-p9/terminal-320.jpg).
- [Briefing a 390 px](evidencias-p9/briefing-390.jpg).

El trabajo y la compilación se hicieron en un worktree aislado. Los scripts y
documentación locales de Cloudflare quedaron en el checkout original.
No se reinició servidor/túnel, no se cambió la URL pública y no se desplegó P9.
La comprensión con estudiantes, lectura desde el fondo y fluidez en proyector
requieren ensayo físico; las capturas no certifican esas condiciones.
