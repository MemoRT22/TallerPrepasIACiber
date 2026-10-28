# P8 — Informe de QA y preparación para Instituto Yitsatil

**Fecha de ejecución:** 28 de octubre de 2026. **Evento:** 30 de octubre, 10:00,
America/Cancun. **Veredicto: NO LISTO** para el montaje del evento mientras
permanezca B1. El recorrido técnico funciona; faltan conectividad y ensayos físicos.

## Base y alcance

P5 PR #6, P6 PR #7 y P7 PR #8 estaban integradas al comenzar.
Rama `test/taller-2-0-pilotaje-final` desde `origin/main`
`9d57d30a0f88b8ba3cb18c5fab4d3426c0b50d57`; su árbol coincide con el último
P7 `3f6e6f0ed2fc364f27fb0bda2a7aef1b2ad38085`.
No se fusionó ni desplegó nada. Sin dependencias, cambios de arquitectura,
mecánicas nuevas ni cambios de balance.

Entorno: macOS, Node 26.0.0, pnpm 11.25.0, compilación de producción,
Express/Socket.IO reales en loopback. El Dockerfile declara Node 22; ese contenedor
no se ejecutó. No hay evidencia de iPhone/Android físicos ni de proyector.

## Corrección crítica

**C1 — FAIL original / PASS corregido:** P7 ocultaba visualmente al impostor
durante el suspenso, pero enviaba inmediatamente `public.reveal` con su identidad.
El servidor ahora omite esa estructura y la auditoría de cierre hasta los 3 s
del reloj de revelación. La interfaz pública y la terminal muestran el suspenso
sin depender del dato secreto. A los 3 s comienza la revelación prevista.
Los logs nominativos y los votos individuales siguen exclusivamente en la
auditoría docente, sin enviarse al monitor.

Pruebas en 0, 2.999 y 3.000 s, transporte Socket.IO, render de suspenso sin
`reveal`, y recorrido real de ambos grupos. No se modificó la puntuación ni
la memoria visual. El docente conserva sus permisos privados anteriores.

## Recorrido real y reproducción

Ejecutar desde la raíz, después de `pnpm build`:

```sh
pnpm exec tsx scripts/p8-realtime-pilot.mts
```

El script imprime las dos pantallas públicas y la ubicación temporal de los
accesos privados (archivo 0600; no versionarlo). Abrir las pantallas e introducir
`start` en su terminal. Esperar unos nueve minutos; `quit` cierra el servidor.
Puerto predeterminado 4180, ajustable con `P8_PORT`. No usar este servidor de
loopback como despliegue para teléfonos.

Dos salas simultáneas con 3 y 6 participantes, una sesión docente y un monitor
por sala. Cada participante se incorporó por código y apodo y recibió su propio
snapshot/rol; un impostor y los demás defensores asignados por el motor.
Se usaron exclusivamente eventos públicos `join`, `action`, `admin`,
`watch` y `resume`. Sin importar el motor, tocar sus salas, forzar roles,
mutar estado ni sustituir Date.now.

El cliente automatizado usa las pistas privadas recibidas, no la verdad interna.
En Correos aplicó una heurística deliberadamente imperfecta; en Identidad tomó
decisiones mucho más rápido que una persona. Los resultados prueban ejecución,
no comprensión adolescente ni equilibrio estadístico. El conocimiento de roles
entre clientes se usó únicamente para elegir los dos escenarios de votación.

Evidencia completa sin tokens, nombres de participantes ni logs privados:
[runtime.json](evidencias-p8/runtime.json). `auditCounts` agrega el registro
disponible al cierre; el buffer del grupo de seis está truncado por la cantidad
de decisiones y no es el conteo histórico completo.

## Cronometría observada, sin acelerar

Inicio: **09:31:20.620** Cancún. Fin: 09:40:32.393 / 09:40:33.459.

| Etapa | Configuración | 3 jugadores, reloj al cerrar | 6 jugadores, reloj al cerrar |
|---|---:|---:|---:|
| Correos | 150 s | 150,000 s | 150,000 s |
| DDoS | 90 s | 90,000 s | 90,000 s |
| Identidad | 120 s | 120,000 s | 120,000 s |
| Recuperación | 120 s | 119,204 s | 119,257 s |
| Total jugable observado | Máximo 480 s | 479,204 s | 479,257 s |
| Recorrido completo, ingreso a reflexión | — | 551,773 s | 552,839 s |

Recuperación terminó legítimamente cuando el último defensor entregó su
fragmento después del segundo 119; no venció su temporizador. No se prolongó
artificialmente después de la victoria. El máximo configurado sigue siendo
480 s. Briefing automático 20 s y cuatro cuentas de 5 s: 40 s de software
adicionales. El desenlace consumió sus 30 s reales.

El script simuló controles docentes de transición y un debate de 2 s: esos
tiempos **no representan una intervención humana**. Presentación, conexión de
teléfonos, explicaciones, debate y reflexión humanos: **NO PROBADO**.
La guía propone una agenda de 22–25 min, todavía no medida con estudiantes.

## Matriz de resultados

PASS significa verificado en el entorno y con el método indicado, no certificación
de dispositivos o del lugar del evento.

| Área | Estado | Evidencia y límite |
|---|---|---|
| Cuatro misiones, 3 y 6 jugadores | PASS | Ambos recorridos completos, cero errores registrados por el script. |
| Correos | PASS | 6/12 inspecciones, 24/48 clasificaciones; aceptación y rechazo, ataque real y cierre de envíos. Precisión 52,94/56,10%; ronda inconclusa, sin ajustar reglas para hacer pasar al robot. |
| DDoS | PASS | 80/147 taps válidos, azules, naranjas, una oleada por impostor, 2/5 escudos. Defensores ganan con 93,67/93,30%. |
| Identidad | PASS | Credenciales, reto, envío avanzado, 6/12 verificaciones y comunicado público observado por Socket.IO. Victoria defensora. |
| Recuperación | PASS | Reto, sabotaje, verificación y 2/5 fragmentos; todos los defensores restauran; estabilidad final 100. |
| Juicio y bonus | PASS | 3 votos: 2/2 defensores acertaron, bonus equipo. 6 votos: 0/5 acertaron, bonus impostor. Marcadores 4–0 y 3–1. Revelación no cambia estabilidad/servicios. |
| Duplicados y reintentos | PASS | Replay de acciones aceptadas en recorrido; suite verifica no doble puntuación/bonus/voto. Proxy TCP verifica replay docente sin duplicar cupo/invitaciones. |
| Último segundo | PASS | Envío a 149,076/149,171 s rechazado; tap expirado a 89,015/89,046 s rechazado; tarjeta inactiva a 119,014/119,281 s rechazada; última entrega de Recuperación aceptada a 119 s. |
| Pérdida/reconexión docente | PASS | Socket real desconectado 1,2 s, resume con misma sesión durante Correos. |
| Reconexión defensor/impostor | PASS | Durante Identidad/DDoS; esperan siguiente ronda, conservan rol. No se readmiten decisiones tardías. |
| Pausa/reanudación | PASS | Suite de motor y transporte: reloj congelado, acciones rechazadas en pausa, briefing y revelación protegidos. No se pausó el recorrido cronometrado. |
| Recarga accidental | PASS parcial | Navegador: terminal en lobby conserva apodo/servicio; pantalla pública recarga y vuelve al QR. Reconexión midronda cubierta por transporte; refresh físico midronda pendiente. |
| Cambio de pestaña | PASS parcial | Alternancia entre monitor, docente y terminal de escritorio conserva sesión. Suspensión móvil prolongada: NO PROBADO. |
| Latencia alta | PASS | Nuevo test TCP: 450 ms por sentido, aproximadamente 900 ms RTT, WebSocket y ACK de 3 s sin ampliarlo. El retardo de 120 ms por acción del grupo de seis es pacing cliente, no emulación de red. |
| Reinicio y nuevo grupo | PASS | Ambas salas: cero jugadores/puntos, estabilidad 100, sesión vieja rechazada, nuevo ingreso sin rol heredado; nuevo QR habilitado desde interfaz. |
| Aislamiento y permisos | PASS | Suite de motor/transporte: rol propio, secretos ausentes del público, acciones docentes denegadas al jugador, validación de fase/sala, votos privados, bonus una vez. |
| Suspenso 0–3 s | PASS | Corrección C1; tests y ambos monitores Socket.IO sin reveal prematuro. |
| Navegador 320×640 / 390×844 | PASS parcial | Capturas y medición DOM de monitor en Correos y terminal en lobby; ancho del documento igual al viewport. No equivale a todas las pantallas jugables táctiles. |
| QR | PASS parcial | Control docente habilita QR y enlace de código correcto; ingreso de navegador por ese destino funciona. Escaneo con cámara física/red del Instituto: NO PROBADO. |
| Pantalla pública en misiones | PASS parcial | Navegadores abiertos durante ambas partidas; HUD/ciudad/temporizadores presentes. Captura móvil de Correos, estados de servicios y reinicio. Comunicado validado por snapshot; su breve ventana visual no fue capturada. |
| Proyección, distancia y superposiciones | NO PROBADO | Sin proyector físico. En 320 px HUD termina en y567,89 y mapa empieza y579,89: no se cruzan; necesita scroll. No afirmar lectura desde el fondo del aula. |
| Consola | PASS acotado | Sin entradas de nivel error capturadas en los dos monitores al concluir; no demuestra ausencia universal de errores. |
| WebGL/reduced motion/desmontaje | PASS automatizado | Suite existente conserva fallback, movimiento reducido y limpieza. Pérdida de contexto GPU real/celular: NO PROBADO. |
| Audio | PASS automatizado / NO PROBADO físico | Suite de audio y pausa; audibilidad, mute y operación en el aula pendientes. No grabar voz de estudiantes. |
| iPhone Safari / Android Chrome | NO PROBADO EN DISPOSITIVO FÍSICO | Las dimensiones de escritorio no acreditan motores móviles. |
| Aprendizaje y balance humano | NO PROBADO | Capacidades de ambos bandos funcionan; no se midieron comprensión, lectura táctil, diversión ni tasa de victorias con estudiantes. |
| Node 22/Docker y hosting | NO PROBADO | Ejecución local Node 26; sin URL operativa facilitada/verificada. |

Capturas reales:
[monitor 320](evidencias-p8/publico-320.jpg),
[monitor 390](evidencias-p8/publico-390.jpg),
[terminal 320](evidencias-p8/jugador-320.jpg),
[terminal 390](evidencias-p8/jugador-390.jpg),
[QR público](evidencias-p8/qr.jpg).
El QR de evidencia apunta a loopback; es material de demostración, no de ingreso
al evento. Los textos e imágenes institucionales existentes aún dicen Artek.

## Rendimiento

- Dos salas simultáneas y nueve clientes automatizados más monitores. ACK máximo
  de acciones 18 ms / 14 ms en loopback; no es SLA de Wi-Fi ni carga de salón.
- Muestras HTTP locales: health 200 en 2,129 ms; HTML 200, 746 bytes, TTFB
  1,747 ms; chunk 3D 200, 566.347 bytes, total 2,152 ms. Sin caché/red móvil
  controladas; **no son tiempo de carga inicial de un teléfono**.
- Build: CityViewport 566,35 kB / gzip 146,98 kB, importación diferida existente.
  Advertencia de chunk mayor de 500 kB conocida, sin crecimiento por esta
  corrección. Se conserva fallback sin WebGL; no se refactorizó Three.js.
- Heap Node al final (120 muestras por sala, unos 24 s): aproximadamente
  23,8–70,3 MB en el proceso compartido. Sin crash. Esto **no** mide crecimiento
  entre varias partidas, memoria GPU, ausencia de fugas ni liberación del renderer.
- FPS, navegación instrumentada, rendimiento de efectos simultáneos en teléfonos,
  perfil GPU y soak de reinicios: **NO PROBADO**. La API de rendimiento de la
  herramienta de navegador no estuvo disponible; no se inventaron mediciones.

## Validación técnica

Pasada final, en el orden solicitado:

| Comando | Resultado |
|---|---|
| `pnpm check` | PASS, exit 0 |
| `pnpm test` | PASS, 204/204, 0 fallos/omitidas/canceladas, 5,621 s |
| `pnpm build` | PASS, exit 0; advertencia de chunk 3D documentada |
| `git diff --check` | PASS, sin errores |

El arranque inicial de pnpm dentro del sandbox quedó sin salida y se canceló;
la secuencia final se ejecutó con permisos de ejecución ampliados. Fue una
incidencia del entorno del gestor, no un timeout de prueba. No se aumentaron
los timeouts existentes.

Durante el desarrollo apareció un fallo de `capacity-lock`: una aserción antigua
esperaba la identidad inmediatamente al revelar. Se corrigió para comprobar
su ausencia hasta 2.999 s y presencia a 3.000 s. La siguiente suite de 203 tests
pasó. El nuevo test de latencia pasó por separado (~4,55 s).
No se detectó un fallo intermitente de producto en esas ejecuciones.

## Bloqueantes y observaciones

| ID | Severidad/estado | Acción necesaria |
|---|---|---|
| B1 | Bloqueante operativo, abierto | Responsable del montaje debe proporcionar y probar URL HTTPS o IP LAN estable accesible desde los teléfonos y el proyector. La prueba local usa 127.0.0.1. El repositorio no tiene homepage configurada ni registros de deployment consultables; eso no descarta un hosting externo desconocido. Seguir la configuración de la guía; no se desplegó automáticamente. |
| B2 | Validación física pendiente | Ensayo con iPhone Safari, Android Chrome/gama media, Wi-Fi del Instituto y laptop/proyector. Verificar QR, suspensión/reconexión, controles táctiles y legibilidad. Sin esto no certificar LISTO PARA EVENTO. |
| O1 | Menor, documentación anterior | README conserva reglas históricas de Correos/DDoS/votación; usar la guía P8 y el plan vigente. No usar esas cifras antiguas para explicar el taller. |
| O2 | Menor, presentación institucional | Interfaz aún muestra Anáhuac/Artek. Confirmar material permitido para Yitsatil antes del evento; no se sustituyó branding sin activos/instrucción. |
| O3 | Menor, móvil | En lobby el botón secundario Salir mide 28 px de alto a 320 px; ampliar área o confirmar usabilidad en ensayo. No afecta controles principales medidos por esta prueba. |
| O4 | Menor, rendimiento | Chunk 3D conocido y métricas físicas/soak pendientes; evitar refactor de riesgo antes del evento. |

La [guía operativa](P8_GUIA_OPERATIVA_YITSATIL.md) incluye checklist de montaje,
comandos, controles, agenda y contingencia sin internet/servidor. El estado técnico
permite continuar el pilotaje local; el montaje del 30 de octubre permanece
**NO LISTO** hasta resolver B1 y completar la evidencia física indicada.
