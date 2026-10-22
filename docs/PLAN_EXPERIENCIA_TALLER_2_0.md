# Plan de experiencia — Taller 2.0

> Checklist maestro para evolucionar **Cancún bajo ataque** como taller de IA +
> Ciberseguridad para preparatorias. Este documento describe el trabajo P0–P8;
> no implementa cambios jugables.

**Base revisada:** `main` en `3c687d3cbaac9531d5985ac144390b34800aa0cf`

**Fecha de línea base:** 22 de octubre de 2026 (America/Cancun)

**Estado general:** P0 en revisión documental; P1–P8 pendientes

**Fuente:** plan maestro adjunto y contraste con código, pruebas y documentación del
repositorio.

## 1. Resultado que se busca

Convertir la partida actual en una experiencia de taller de **20–25 minutos** con
ocho minutos efectivos de juego, más intensa, comprensible y memorable, sin
convertirla en un producto ni reescribir su arquitectura.

| Bloque | Duración objetivo | Propósito |
| --- | ---: | --- |
| Gancho narrativo | 2–3 min | Presentar la amenaza y crear urgencia. |
| Incorporación y reglas | 2–3 min | Conectar 3–6 teléfonos y explicar roles. |
| Cuatro misiones | **8 min** | Correos 2:30, DDoS 1:30, Identidad 2:00 y Recuperación 2:00. |
| Transiciones y briefings | 3–4 min | Una regla central por misión; explicación de hasta 20 s. |
| Votación, revelación y reflexión | 4–6 min | Cerrar el arco, explicar evidencia y aprendizaje. |
| **Total** | **20–25 min** | Ritmo de taller, no sesión de producto. |

Los ocho minutos no incluyen briefings, cuentas atrás ni transiciones. Los
valores 150/90/120/120 segundos deben ser las reglas predeterminadas reales del
servidor, no solo etiquetas, y el docente debe conservar sus ajustes.

## 2. Guardarraíles

### Dentro del alcance

- Experiencia de juego, misiones, interfaz, ritmo, dinamismo, dificultad,
  feedback, accesibilidad y claridad educativa.
- Ajustes mínimos de `shared/types.ts` y `server/engine.ts` cuando una mecánica
  requiera autoridad del servidor, privacidad o balance.
- Activos locales previamente generados con IA, claramente descritos como tales.
- Pruebas de reglas, privacidad, UI, regresión y ensayo del taller.

### Fuera de alcance

- Base de datos, persistencia permanente, analítica, ranking, cuentas, chat o
  autenticación empresarial.
- Nuevos servicios, microservicios, réplicas, APIs pagadas, proveedor de IA en
  vivo o infraestructura adicional.
- Reemplazar React, TypeScript, Express, Socket.IO o Three.js; cambiar el modelo
  de salas, las audiencias o la autoridad actual del servidor.
- Ataques reales, phishing dirigido, enlaces maliciosos reales o recursos de
  terceros sin consentimiento.
- Mezclar varias etapas en un PR, hacer merge o desplegar sin indicación expresa.

### Invariantes de experiencia y seguridad

- [ ] Una laptop del docente con pantalla extendida y un proyector; 3–6
      voluntarios juegan desde sus teléfonos, sin instalar aplicaciones.
- [ ] Se conservan consola docente, terminal de jugador, pantalla pública,
      salas, QR, pausa, reconexión, roles secretos y autoridad del servidor.
- [ ] La pantalla pública nunca revela rol, origen de sabotaje, decisiones
      privadas, tokens ni culpable antes de la revelación.
- [ ] Cada misión tiene una regla central y, como máximo, una decisión
      estratégica nueva que pueda explicarse en 20 segundos.
- [ ] Hacer lo correcto —inspeccionar, verificar o dejar pasar tráfico azul— no
      genera una penalización falsa.
- [ ] Botones táctiles grandes, texto breve y legible a distancia, movimiento
      reducido, alternativa sin WebGL y audio opcional con silencio rápido.
- [ ] La ciudad muestra consecuencias agregadas, no soluciones ni acciones
      individuales.
- [ ] La información educativa diferencia activos generados previamente con IA
      de una supuesta inferencia en vivo.
- [ ] Una derrota explica al menos una pista útil y un error de juicio sin
      avergonzar a participantes.

## 3. Diagnóstico de la base real

La base ya resuelve piezas importantes que se deben conservar:

- Cupo de 3–6 jugadores, QR público, roles privados estables, una laptop docente,
  proyector pasivo y terminales móviles.
- Reloj y clasificación autoritativos, pausa, ajustes docentes, briefing
  sincronizado de 20 segundos y cuenta atrás de 5 segundos.
- Separación de snapshots públicos/privados, votación individual, revelación
  controlada y reconexión sin reescribir decisiones.
- Ciudad Three.js con seis servicios, estados agregados, efectos por impacto,
  fallback accesible, movimiento reducido y liberación de recursos.
- Suite automatizada amplia para motor, transporte, privacidad, UI, QR,
  capacidad, reconexión y ciudad.

Brechas frente a la experiencia 2.0:

| Área | Estado actual comprobado | Brecha 2.0 |
| --- | --- | --- |
| Ritmo | 300/180/180/300 s = 16 min efectivos. | 150/90/120/120 s = 8 min; recalibrar reglas dependientes del reloj. |
| Correos | Remitente + asunto; aceptar/descartar; plantillas obvias; cola extensa. | Vista previa, Inspeccionar, plantillas creíbles, 6–8 decisiones significativas. |
| DDoS | Azul pasa y rojo se intercepta; oleadas; el impostor inyecta tráfico. | Tres tramos claros, defensa de un uso y no penalizar espera azul correcta. |
| Identidad | Avatar, código y símbolo con diferencias observables; inyección impostora. | Retratos sintéticos ficticios, pistas graduadas, Verificar y una suplantación avanzada justa. |
| Recuperación | César +3; defensores resuelven fragmentos; impostor recibe un señuelo sin efecto. | Carrera activa: reto privado, un sabotaje de clave y respuesta defensiva. |
| Ciudad | Seis servicios y efectos por estado; los bloqueos se normalizan entre fases. | Estabilidad 0–100 y memoria de cicatrices narrativas sin conservar bloqueos operativos. |
| Final | Voto privado y revelación visual; votos y recuperación no puntúan. | Clímax de 60–90 s, bonus definidos y explicación de acierto/error. |
| Piloto | README recomienda 3 y 6 dispositivos. | No hay evidencia registrada de ensayo físico 20–25 min ni balance 2.0. |

### Línea base de verificación

Ejecutada sobre el commit indicado, antes de crear este documento:

| Comando | Resultado | Evidencia / observación |
| --- | --- | --- |
| `pnpm check` | **PASS** | TypeScript sin errores. |
| `pnpm test` | **PASS** | 102/102 pruebas, 0 fallos, al repetir de forma aislada. |
| `pnpm build` | **PASS con advertencia** | Cliente y servidor compilados. Vite advierte que el chunk diferido de `CityViewport` supera 500 kB (565,11 kB; gzip 146,62 kB). |

Nota reproducible: una primera ejecución de `pnpm test` en paralelo con
`pnpm build` dio 101/102; `tests/transport.test.ts` recibió 404 al solicitar
`/api/health` mientras Vite regeneraba `dist`. La misma suite, aislada después
del build, pasó 102/102. Para la aceptación de cada etapa, ejecutar `check`,
`test` y `build` **en serie**. No se probó hardware físico en P0.

## 4. Orden de trabajo y estado

| Etapa | Entregable | Dependencia | Estado en este PR |
| --- | --- | --- | --- |
| P0 | Guardarraíles, diagnóstico, línea base y checklist | Ninguna | **En revisión documental** |
| P1 | Ritmo exprés y legibilidad | P0 aceptada | Pendiente |
| P2 | Recuperación con impostor activo | P1 | Pendiente |
| P3 | Correos con investigación | P1 | Pendiente |
| P4 | Identidades y contenido IA local | P1 | Pendiente |
| P5 | DDoS con estrategia | P1 | Pendiente |
| P6 | Ciudad con memoria, estabilidad y audio opcional | P2–P5 | Pendiente |
| P7 | Votación, puntuación y desenlace | P2–P6 | Pendiente |
| P8 | QA, balance y ensayo real | P1–P7 | Pendiente |

Cada etapa debe salir en una rama y PR propios, nacidos de `main` actualizado.
No marcar una casilla con evidencia parcial ni arrastrar cambios de otra etapa.

## 5. Checklist por etapa

### P0 — Guardarraíles y línea base

**Objetivo:** fijar alcance, realidad técnica y criterios verificables sin cambiar
la experiencia existente.

**Completado en este PR documental**

- [x] Revisar código, README, pruebas y plan maestro sobre `3c687d3`.
- [x] Registrar tiempos, mecánicas, audiencias, privacidad y brechas reales.
- [x] Ejecutar `pnpm check`, `pnpm test` y `pnpm build`; documentar resultados y
      la interferencia observada al correr test/build en paralelo.
- [x] Crear el checklist acumulativo P0–P8 y los guardarraíles.
- [x] Mantener el diff exclusivamente en `docs/`, sin cambios jugables.
- [ ] Obtener revisión y cerrar el PR documental sin merge automático.

**Criterios de aceptación**

- [x] El plan distingue hechos actuales, hipótesis y pendientes de piloto.
- [x] No se añadieron dependencias, servicios, infraestructura o funcionalidad.
- [x] La suite aislada y el build establecen una referencia reproducible.
- [ ] El equipo confirma este archivo como checklist único de las etapas futuras.

**Decisión de pilotaje:** P0 no valida diversión ni hardware; solamente congela
la referencia. Las verificaciones físicas se concentran en P8 y se anticipan con
pruebas de 3 y 6 jugadores en cada PR de mecánica.

### P1 — Ritmo exprés y legibilidad

**Objetivo:** reducir el juego efectivo a ocho minutos y hacer que cada misión se
entienda rápidamente, conservando los controles docentes.

**Pendientes**

- [ ] Cambiar defaults a Correos 150 s, DDoS 90 s, Identidad 120 s y
      Recuperación 120 s.
- [ ] Auditar cooldowns, spawns, expiraciones, pulsos, congelamientos, metas y
      cierre para que escalen al nuevo reloj; no cambiar solo etiquetas.
- [ ] Conservar ajustes docentes, pausa, repetición, avance manual y arranque
      automático/manual existentes.
- [ ] Resumir cada briefing a una regla central, una acción predominante y un
      aprendizaje; lectura máxima de 20 s.
- [ ] Mantener la cuenta atrás autoritativa de 5 s y hacer visibles transiciones,
      objetivo y tiempo restante en móvil y proyector.
- [ ] Cubrir 3–6 jugadores, pausa/reanudación, último segundo y cambio de fase.

**Criterios de aceptación**

- [ ] Los defaults del motor y la UI suman exactamente 480 s y los límites
      dependientes del reloj terminan con la fase correcta.
- [ ] El docente puede ajustar tiempos dentro de los límites vigentes.
- [ ] Ninguna acción es aceptada durante briefing, cuenta atrás, pausa o cierre.
- [ ] Un alumno nuevo explica qué debe hacer tras leer cada briefing por 20 s.
- [ ] Proyector y teléfono priorizan mensajes grandes y una acción clara.

**Decisión de pilotaje:** fijar 150/90/120/120 como variante A. Medir tiempo real
desde el inicio del primer briefing hasta el cierre de Recuperación; si las
transiciones superan cuatro minutos, recortar texto antes que reglas.

### P2 — Recuperación: el impostor vuelve a jugar

**Objetivo:** convertir Recuperación en una carrera justa de 120 s sin romper la
validación actual de fragmentos César.

**Pendientes**

- [ ] Mantener plaintext, orden de fragmentos y validación por sesión actuales.
- [ ] Generar para el impostor un microreto criptográfico privado, corto y
      variable por partida; no reutilizar una respuesta fija.
- [ ] Al resolverlo, desbloquear exactamente un sabotaje por ronda contra un
      fragmento pendiente de un defensor activo.
- [ ] Recalcular el ciphertext desde el mismo plaintext con otra clave César
      (hipótesis inicial: +3 → +5); nunca cambiar la respuesta correcta.
- [ ] Rechazar duplicados, reintentos ganadores, objetivos resueltos/ausentes,
      ronda acabada y cambio múltiple de clave.
- [ ] Mostrar públicamente solo «INTEGRIDAD DEL CIFRADO COMPROMETIDA» y progreso
      agregado, sin origen ni identidad.
- [ ] Ofrecer al afectado una verificación de clave de uso limitado/costo breve y
      una pista suficiente para resolver sin ella.
- [ ] Explicar que César es histórico y no cifrado moderno seguro.

**Criterios de aceptación**

- [ ] Hay como máximo un sabotaje total y la misión siempre es resoluble.
- [ ] El plaintext esperado no cambia y el ciphertext corresponde a la clave
      vigente, incluso en último segundo o reintento.
- [ ] El impostor realiza una acción relevante sin obtener victoria automática.
- [ ] Desconexión, pausa, repetición y ronda nueva limpian capacidades viejas.
- [ ] Con 3 y 6 jugadores, los defensores pueden completar la frase en 120 s.
- [ ] Ningún snapshot público identifica atacante u objetivo individual.

**Decisión de pilotaje:** probar un cambio +3 → +5, una verificación defensiva por
persona y un retraso perceptible corto. Comparar tasa de resolución, tiempo de
recuperación y comprensión de la alerta; simplificar el microreto si requiere
más de 20 s de explicación.

### P3 — Bandeja comprometida

**Objetivo:** sustituir el reconocimiento trivial por decisiones de confianza con
evidencia y tiempo para pensar.

**Pendientes**

- [ ] Añadir una microvista previa segura de 1–2 líneas a cada mensaje.
- [ ] Ofrecer Aceptar / Inspeccionar / Descartar como tres acciones táctiles.
- [ ] Inspeccionar debe revelar una señal verificable —dominio completo,
      encabezado simulado o contexto— con costo/uso limitado, sin dictar la
      respuesta.
- [ ] Crear un set reproducible de mensajes legítimos y falsos con urgencia,
      autoridad y suplantación; incluir legítimos poco obvios y falsos positivos.
- [ ] Usar exclusivamente identidades ficticias y dominios `.example`; ningún
      enlace real ni texto libre de phishing.
- [ ] Dar al impostor plantillas balanceadas por táctica, con frecuencia viable
      para 150 s y sin feedback privado inmediato que delate resultados.
- [ ] Limitar la carga a 6–8 decisiones significativas por jugador.

**Criterios de aceptación**

- [ ] La respuesta no depende de una única pista trivial o conocimiento externo.
- [ ] Todo caso queda inequívoco después de observar evidencia suficiente.
- [ ] Inspeccionar aporta valor, pero no vuelve automático cada caso.
- [ ] La meta del atacante es alcanzable pero no casi instantánea en 3 y 6
      jugadores.
- [ ] No se filtran clasificación, autor ni aceptación individual al proyector.
- [ ] La UI cabe en teléfono sin menús largos y se entiende en 20 s.

**Decisión de pilotaje:** comenzar con dos inspecciones por defensor y 6–8
mensajes por persona. Medir uso, precisión, decisiones por minuto y si alumnos
explican la señal observada, no solo el resultado.

### P4 — Identidad robada y contenido IA

**Objetivo:** aumentar verosimilitud sin convertir apariencia facial o audio en
prueba de identidad.

**Pendientes**

- [ ] Incorporar retratos sintéticos de personas ficticias como activos locales,
      comprimidos y con origen/permisos documentados; usar placeholders honestos
      mientras falten.
- [ ] Diseñar 2–3 pistas por tarjeta con grados de parecido y evidencia
      verificable; evitar tarjetas indetectables.
- [ ] Añadir Verificar para defensores, hasta dos usos, revelando un dato
      confiable como vigencia, autorización o nivel permitido.
- [ ] Dar al impostor un microreto privado que desbloquee una sola suplantación
      avanzada con una pista adicional disponible mediante Verificar.
- [ ] Preparar audio opcional pregrabado con la voz del propio docente solamente
      con permiso; texto equivalente, mute y flujo completo sin archivo/audio.
- [ ] Comunicar que fotos y voces sintéticas son material previo, no detección de
      IA en vivo.

**Criterios de aceptación**

- [ ] Toda tarjeta tiene respuesta defendible mediante datos, no solo apariencia.
- [ ] Verificar se limita y consume un costo perceptible sin bloquear la ronda.
- [ ] Hay como máximo una suplantación avanzada por partida.
- [ ] Ausencia de retratos/audio opcional no rompe UI, build ni misión.
- [ ] No se usan rostros o voces de terceros sin autorización.
- [ ] Imágenes son legibles y ligeras en teléfono; audio puede silenciarse de
      inmediato y no revela roles.

**Decisión de pilotaje:** dos verificaciones por defensor. Audio desactivado por
defecto y siempre acompañado por texto; usarlo solo tras consentimiento escrito
del docente. Comparar claridad y tiempo con audio presente/ausente.

### P5 — DDoS con estrategia

**Objetivo:** conservar la mecánica de reflejos, añadir una decisión de emergencia
y hacer perceptible la escalada de 90 s sin castigar la conducta correcta.

**Pendientes**

- [ ] Ajustar curva suave 0–30 s, creciente 30–60 s y crítica 60–90 s con tasas
      derivadas de la duración, no números aislados.
- [ ] Añadir una defensa de emergencia de un uso por jugador, con duración breve,
      efecto claro y una sola decisión de activación.
- [ ] Sustituir/encauzar la inyección actual del impostor mediante un miniobjetivo
      privado que desbloquee una única oleada dirigida.
- [ ] No seleccionar jugadores ausentes/bloqueados ni revelar el origen.
- [ ] Corregir inactividad: si solo existe tráfico azul que debe pasar, esperar no
      suma puntos malos; acciones rechazadas tampoco deben limpiar el contador.
- [ ] Verificar fluidez táctil y animación en un teléfono de gama media.

**Criterios de aceptación**

- [ ] Participantes perciben tres tramos de dificultad y la derrota no es
      inevitable con 3 o 6 jugadores.
- [ ] Azul se deja pasar, naranja se intercepta y la penalización de inactividad
      solo corre cuando existe una acción correcta pendiente.
- [ ] Cada defensa y cada oleada especial puede ocurrir como máximo una vez según
      su alcance definido.
- [ ] Pausa, último segundo, expiración, deduplicación y reinicio son coherentes.
- [ ] Proyector comunica presión agregada sin señalar al impostor.

**Decisión de pilotaje:** una defensa por jugador de duración inicial de cuatro
segundos y una oleada especial total. Medir pérdidas por tramo, uso temprano/tardío
y cuadros por segundo; ajustar tasas antes que añadir mecánicas.

### P6 — Ciudad viva con memoria

**Objetivo:** convertir el mapa en memoria visible de las consecuencias sin
confundir narrativa acumulada con bloqueos operativos de la ronda.

**Pendientes**

- [ ] Añadir HUD de estabilidad 0–100 derivado solo de resultados y estados
      públicos; sin persistencia externa ni acciones privadas.
- [ ] Definir efectos comprensibles para energía, movilidad, comunicaciones,
      agua, turismo y municipal en normal/riesgo/caído/recuperado.
- [ ] Conservar cicatrices narrativas al cambiar de misión y reiniciar los
      bloqueos que las reglas necesitan reiniciar.
- [ ] Asegurar que una reacción visual no permita inferir quién actuó.
- [ ] Añadir sonidos cortos opcionales solo si aportan ritmo; mute visible,
      alternativa textual y sin depender de autoplay.
- [ ] Mantener carga bajo demanda, límite de recursos, `prefers-reduced-motion`,
      pestaña oculta, limpieza GPU y fallback sin WebGL.

**Criterios de aceptación**

- [ ] Los seis servicios tienen efectos distinguibles y explicación accesible.
- [ ] Estabilidad es determinista desde datos públicos y no filtra secretos.
- [ ] Las secuelas sobreviven transiciones, pero no dejan una fase posterior
      operativamente bloqueada.
- [ ] Estados normal, riesgo, crítico y recuperación son legibles a distancia.
- [ ] Móvil/proyector objetivo mantienen fluidez y el fallback comunica lo mismo.
- [ ] Audio, si existe, es prescindible y silenciable.

**Decisión de pilotaje:** probar tres intensidades de cicatriz y elegir la menor
que el salón recuerde sin interpretar la partida como perdida de antemano. No
añadir audio hasta confirmar que el HUD y las consecuencias visuales bastan.

### P7 — Votación y desenlace

**Objetivo:** lograr un clímax de 60–90 s donde Recuperación y reconocer al
impostor importen al resultado y al aprendizaje.

**Pendientes**

- [ ] Puntuar Recuperación completa +1 defensores; incompleta +1 impostor,
      únicamente al cerrar la fase.
- [ ] Abrir debate oral breve y mantener voto privado de jugadores.
- [ ] Aplicar bonus de voto al revelar, no antes; el voto del impostor se muestra
      pero no cuenta para el bonus.
- [ ] Implementar y probar mayoría, empates, no voto y desconexiones sin revelar
      quién es defensor durante la votación.
- [ ] Mostrar puntaje por misión, bonus de Recuperación y bonus de voto de forma
      separada, sin reescribir rondas cerradas.
- [ ] Diseñar revelación sobria en la ciudad con nombre/cobertura del impostor,
      consecuencia final y una reflexión basada en datos ya públicos o revelados.
- [ ] Explicar un acierto y un error de juicio sin exhibir individualmente a un
      alumno.

**Criterios de aceptación**

- [ ] Antes de revelar no se puede inferir el rol por votos, contador o puntos.
- [ ] Bonus se otorgan una vez, son idempotentes y sobreviven reintentos de red.
- [ ] Empates, abstenciones y desconexiones producen un resultado definido en 3 y
      6 jugadores.
- [ ] Voto + revelación duran menos de dos minutos después del debate docente.
- [ ] Reiniciar grupo limpia revelación y bonus sin afectar controles existentes.

**Decisión de pilotaje:** tomar una instantánea de defensores elegibles al abrir
la votación y exigir mayoría estricta de sus votos por el impostor real; empate,
abstención o falta de mayoría da el bonus al impostor. Validar si esta regla se
siente justa ante desconexiones; si no, contar solo defensores conectados al
cierre y documentar el cambio.

### P8 — QA y ensayo del taller

**Objetivo:** validar el flujo completo y el balance sin añadir funciones nuevas.

**Pendientes**

- [ ] Ejecutar en serie `pnpm check`, `pnpm test` y `pnpm build` sobre el conjunto
      final; registrar PASS/FAIL/NO PROBADO.
- [ ] Ensayar una partida con 3 jugadores y otra con 6 usando teléfonos reales y
      navegadores disponibles, una laptop y proyector/pantalla extendida.
- [ ] Cronometrar gancho, incorporación, misiones, transiciones, debate,
      revelación y reflexión; confirmar 20–25 min y 8 min efectivos.
- [ ] Probar ambos roles, sabotajes, respuestas defensivas, pausa, último segundo,
      repetición, nuevo grupo y desconexión/reincorporación.
- [ ] Revisar privacidad desde el proyector durante toda la partida y con 3/6
      puestos.
- [ ] Probar mute, ausencia de audio/retratos opcionales, movimiento reducido,
      pérdida de WebGL y teléfono de gama media.
- [ ] Preparar guía docente, recursos locales, consentimiento de voz si aplica y
      plan B con grabación/capturas de una partida de prueba.
- [ ] Documentar defectos reproducibles y corregir solo bloqueantes aprobados; no
      incorporar nuevas características en P8.

**Criterios de aceptación**

- [ ] Cuatro misiones suman 8:00 y el taller completo entra en 20–25 min.
- [ ] Funciona con 3, 4, 5 y 6 participantes; al menos 3 y 6 tienen ensayo físico.
- [ ] Cada 20–30 s ocurre un hecho perceptible sin alarma continua ni sobrecarga.
- [ ] Impostor tiene una acción relevante en cada fase y ningún sabotaje vuelve
      irresoluble la partida.
- [ ] Recursos esenciales están locales; fallbacks terminan el flujo completo.
- [ ] Privacidad, accesibilidad, rendimiento, suite, tipos y build quedan PASS, o
      las excepciones están explícitas y aceptadas.

**Decisión de pilotaje:** dos ensayos mínimos (3 y 6 jugadores), alternando quién
es impostor y usando al menos un teléfono de gama media. Umbral inicial: terminar
80 % o más de las misiones sin explicación adicional y dentro de ±15 s del reloj;
si falla, recortar contenido antes de aumentar tiempo.

## 6. Matriz de decisiones de piloto

Estas son hipótesis iniciales, no reglas permanentes. Cada PR debe actualizar la
columna de evidencia sin ocultar resultados negativos.

| Decisión | Variante inicial | Evidencia a recoger | Estado |
| --- | --- | --- | --- |
| Duraciones | 150/90/120/120 s | Tiempo real, fases incompletas, pausas y comprensión. | Pendiente P1/P8 |
| Correos | 2 inspecciones; 6–8 decisiones por jugador | Uso, precisión, razón verbalizada y tasa de victoria. | Pendiente P3 |
| DDoS | Escudo 4 s por jugador; 1 oleada especial | Pérdidas 0–30/30–60/60–90, FPS y momento de uso. | Pendiente P5 |
| Identidad | 2 verificaciones por defensor | Uso, falsos positivos, tiempo por tarjeta y claridad. | Pendiente P4 |
| Audio sintético | Apagado por defecto; texto siempre | Consentimiento, audibilidad, valor narrativo y plan sin audio. | Pendiente P4/P8 |
| Recuperación | 1 cambio +3→+5; 1 verificación por afectado | Tiempo, éxito 3/6, comprensión y frustración. | Pendiente P2 |
| Cicatrices | Tres intensidades a comparar | Recuerdo, legibilidad y sensación de derrota anticipada. | Pendiente P6 |
| Bonus de voto | Mayoría estricta de defensores elegibles al abrir | Justicia percibida con empate, abstención y desconexión. | Pendiente P7 |
| Taller | Ensayos completos con 3 y 6 jugadores | Duración 20–25 min, explicación extra, incidentes y diversión. | Pendiente P8 |

## 7. Definition of Done global

- [ ] El juego funciona con 3, 4, 5 y 6 participantes, sin laptop de alumnos.
- [ ] La pantalla pública mantiene secretos hasta la revelación.
- [ ] Los cuatro relojes base son 150/90/120/120 y siguen siendo ajustables.
- [ ] El juego efectivo dura 8:00 y el taller completo 20–25 min en ensayo real.
- [ ] El impostor actúa en las cuatro misiones y los defensores pueden responder.
- [ ] Cada misión tiene curva de tensión perceptible, justa y explicable en 20 s.
- [ ] Inspeccionar, verificar y esperar tráfico legítimo no se penaliza.
- [ ] Ciudad, puntuación y feedback usan solo datos públicos antes del cierre.
- [ ] Activos IA son previos, locales, consentidos y descritos honestamente.
- [ ] Audio puede silenciarse; movimiento reducido y fallback sin WebGL completan
      el flujo.
- [ ] Cada PR incluye pruebas del área, privacidad y regresión; `check`, `test` y
      `build` se ejecutan en serie.
- [ ] Existe al menos un ensayo real con 3 y otro con 6 teléfonos, guía docente y
      plan B.
- [ ] No se añadieron bases de datos, servicios, infraestructura o dependencias
      sin justificación crítica y aprobación explícita.

## 8. Plantilla de cierre para cada etapa

Copiar esta sección al actualizar el checklist:

```text
Etapa:
Rama / PR / SHA:
Estado: pendiente | en curso | en revisión | aceptada | bloqueada
Cambios de experiencia:
Archivos modificados:
check:
test:
build:
Pruebas manuales 3 jugadores:
Pruebas manuales 6 jugadores:
Privacidad del proyector:
Riesgos o regresiones:
Decisiones de piloto y evidencia:
Pendientes transferidos:
Merge/deploy: NO
```

## 9. Riesgos que vigilar

| Riesgo | Señal temprana | Respuesta |
| --- | --- | --- |
| Sobrecarga cognitiva | Briefing supera 20 s o se explica dos veces. | Eliminar texto/opciones antes de ampliar tiempo. |
| Ventaja injusta del impostor | Victoria casi inmediata o defensa sin respuesta. | Limitar frecuencia/uso y asegurar evidencia defensiva. |
| Filtración por feedback | El proyector reacciona a una acción individual. | Agregar por pulsos/umbrales y revisar snapshots públicos. |
| Tiempos nuevos incoherentes | Spawn/cooldown continúa después del cierre. | Derivar reglas del reloj y cubrir bordes con tiempo falso. |
| Rendimiento 3D/multimedia | Tirones, calentamiento o chunk creciente. | Reusar recursos, comprimir activos y conservar fallback. |
| IA presentada incorrectamente | Participantes creen que un modelo evalúa en vivo. | Etiquetar material previo y explicar verificación humana. |
| Pilotaje no representativo | Solo se prueba en escritorio o con desarrolladores. | Ensayar 3/6 teléfonos y pedir explicación a alumnos nuevos. |
| PRs demasiado grandes | Una etapa cambia varias mecánicas. | Separar, revertir alcance extra y conservar una novedad central. |

## 10. Regla de mantenimiento

Este archivo es la fuente única de seguimiento. Cada etapa debe actualizar solo
su estado, evidencias, decisiones y pendientes; no borrar casillas no completadas
ni reescribir la línea base. Si un piloto demuestra que una idea perjudica ritmo,
claridad o justicia, se documenta y se recorta: preservar la esencia del taller
tiene prioridad sobre completar una característica.
