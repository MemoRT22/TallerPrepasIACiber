# E3 — Auditoría de presión y balance de Identidad

**Base auditada:** `main` actualizado al iniciar, `274e439d737190aeff7eb3fec8aa3f1e66482707` (PR #11 integrado). Rama: `analysis/e3-identity-pressure`.

**Decisión:** entregar diagnóstico, protocolo y experimentos reproducibles, **sin cambiar reglas, interfaz ni parámetros de producción**. Se conserva la misión de **120 s**, precisión objetivo **70 %**, dos verificaciones y desafío del impostor. No se propone una corrección funcional: los límites examinados se comportan conforme al código y sus pruebas; los riesgos encontrados requieren una decisión pedagógica/de balance y evidencia humana antes de integrar cambios.

No hay datos de estudiantes en este documento. Todos los números de resultados siguientes son sintéticos. El ensayo humano está **pendiente**; sus casillas se dejan en blanco.

## 1. Diagnóstico ejecutivo

1. **La expiración y la inactividad son presiones independientes.** Una tarjeta puede seguir vigente a los 5 s y haber generado ya un punto malo. Al expirar una legítima se pierde una oportunidad del numerador; un punto malo aumenta el denominador. No son dos nombres para el mismo evento.
2. **Verificar no detiene el reloj de la tarjeta.** Reinicia la inactividad a 5 s; la consulta tarda 1,5 s. El motor exige al menos 3 s disponibles para empezar, de modo que quedan al menos 1,5 s para decidir tras recibir evidencia, si no cambia la configuración. Una consulta legal no puede consumir por sí sola toda la vigencia restante.
3. **No se reinicia la inactividad por una expiración automática.** La siguiente tarjeta puede heredar una fecha de penalización próxima. Esto está implementado como inactividad continua sin acción válida, no como una tolerancia individual por tarjeta. Cambiarlo sería balance, no una reparación obvia.
4. **La precisión no mide todos los errores de Identidad.** Mide autorizaciones legítimas respecto de legítimas mostradas más inactividad. Aceptar falsas incrementa infiltraciones por otra vía. Por eso un resultado defensivo favorable no demuestra, por sí solo, que se aprendió a distinguir autorización de parecido visual.
5. Existe un **riesgo mecánico reproducible** para lectores que necesiten más de 5 s, pero aún no sabemos cuántos alumnos necesitan ese tiempo, si entienden el registro o cómo cambia su conducta ante la presión. Las simulaciones no justifican elegir un balance definitivo.

## 2. Fase A — Auditoría técnica

### 2.1 Los tres ritmos y la duración real

Con 120 s, `identityStage` divide la misión por tercios:

| Reloj de la misión | Ritmo | Vigencia de una tarjeta al activarse | Contenido y cambios |
| --- | --- | --- | --- |
| 0 ≤ t < 40 s | Inicial | 10 s | Falsas automáticas obvias: retrato o persona diferente; legítimas intercaladas. |
| 40 ≤ t < 80 s | Ágil | 8 s | Falsas sutiles: folio, nombre, nivel o vigencia. Aparece una legítima urgente por tramo; urgencia no equivale a fraude. La avanzada del impostor se habilita desde t=40 s si resolvió su expediente. |
| 80 ≤ t < 120 s | Crítico | 6 s | Continúan las sutiles y las legítimas, con menos tiempo por tarjeta. No cambia la ventana de inactividad ni la consulta de 1,5 s. |

Detalles importantes:

- El plazo se asigna **al mostrar/activar** la tarjeta, no al crearla en la cola. Una pendiente no pierde tiempo mientras espera.
- Hay hasta dos tarjetas pendientes. Su dificultad se determina cuando se generan; puede haber un desfase de contenido al cruzar un tercio. En cambio, su duración se calcula al activarse.
- Una tarjeta activada en t=39,9 s conserva sus 10 s al cruzar t=40 s. Una nueva en t=40 s recibe 8 s. Lo mismo ocurre al cruzar t=80 s.
- La oportunidad efectiva termina en `min(expires, fin de misión)`. Una tarjeta cerca de t=120 s puede tener menos tiempo utilizable que los 6 s nominales; no prolonga la misión.
- El comunicado institucional se programa **a la mitad, t=60 s**, dentro del ritmo ágil; no al comenzar el crítico. Dura 14 s como aviso público y coloca una avanzada en la cola sin desplazar la tarjeta activa. No garantiza 14 s de decisión para esa tarjeta.
- La vigencia impresa de la credencial ficticia, como `11/27`, es un campo a comparar; no es ninguno de los dos relojes de interacción.

Fuentes: [`identityStage`](../server/engine.ts#L2744), [`newAutomaticIdentity`](../server/engine.ts#L2821), [`identityLimit` / `activateIdentity`](../server/engine.ts#L2886), [`advanceIdentity`](../server/engine.ts#L2931), [reglas predeterminadas](../shared/types.ts#L87).

### 2.2 Inicio, repetición y reinicio de la inactividad

La cuenta se arma al existir una tarjeta mostrada, con la terminal activa y conectada, durante juego en curso, sin pausa, bloqueo ni espera de la siguiente ronda. El primer vencimiento es el reloj de misión actual +5.000 ms; después suma otro punto malo cada 5.000 ms sin acción válida. Leer, comparar campos o desplazarse por la pantalla no constituyen acciones del servidor.

Reinician esa cuenta las acciones **aceptadas** `identity:decide`, `identity:verify` y `identity:send`. Una decisión aceptada reinicia aunque sea incorrecta. El envío normal es una herramienta exclusiva del impostor y reinicia su propia cuenta; sus puntos malos no entran en la precisión defensora. Resolver el expediente o enviar la avanzada no figuran en la lista de reinicio.

No reinician los rechazos, tarjetas inexistentes, botones no disponibles ni retransmisiones con el mismo identificador ya deduplicado. Una decisión válida activa la siguiente tarjeta y reinicia la cuenta; una expiración automática activa la siguiente **sin** ese reinicio. Pausar congela el reloj, las expiraciones y la consulta. Reiniciar ronda borra los contadores y devuelve las dos consultas. La desconexión no genera penalizaciones nuevas y la terminal espera la siguiente ronda al reincorporarse; no elimina retrospectivamente lo ya contabilizado.

Ejemplos comprobados con reloj simulado:

| Secuencia | Resultado actual |
| --- | --- |
| Primera tarjeta en t=0, ninguna acción | A t=4,999 s: 0 puntos malos. A t=5 s: 1, aunque la tarjeta sigue vigente hasta t=10 s. |
| Sigue sin actuar hasta t=10 s | La tarjeta expira y es reemplazada; el contador llega a 2. La nueva tarjeta no obtiene una tolerancia independiente. |
| Verificar aceptado en t=4 s | Evidencia lista en t=5,5 s; siguiente vencimiento de inactividad en t=9 s. |
| Reenviar el mismo evento en t=4,5 s | No consume otro uso ni mueve el vencimiento de t=9 s. |
| Intentar decidir mientras la consulta está pendiente | Rechazado; no reinicia la cuenta. |

Fuentes: [deduplicación de acciones](../server/engine.ts#L1039), [reinicio y elegibilidad de inactividad](../server/engine.ts#L2159), [penalización recurrente](../server/engine.ts#L2232), [reincorporación](../server/engine.ts#L1132).

### 2.3 Verificar, expiración y casos límite

- Dos usos por participante y ronda, compartidos entre todas sus tarjetas. Consulta de 1.500 ms del reloj del servidor. No modifica `card.expires` ni los 120 s.
- Mientras responde, Permitir y No permitir quedan bloqueados tanto en UI como en servidor. La evidencia aún no se publica. Después aparecen tres líneas del registro; la decisión sigue siendo del jugador.
- Se exige `min(fin de tarjeta, fin de misión) - ahora >= 3.000 ms`. Con menos margen se rechaza sin consumir un uso. Exactamente 3 s sí se admite.
- En una tarjeta crítica nueva de 6 s, consultar en t+0 deja 4,5 s tras recibir evidencia; consultar en t+3 deja solo 1,5 s. No hay una prórroga para leer el registro.
- Una consulta aceptada reinicia 5 s; durante sus 1,5 s **no llega a vencer esa nueva cuenta**. Eximir únicamente la consulta pendiente, sin dar crédito posterior, no reduce penalizaciones en el flujo legal actual.
- La prueba existente de expiración durante consulta **acorta artificialmente** `card.expires` a 500 ms después de iniciar la verificación. No es una muestra de que una consulta normal agote el plazo. En ese caso defensivo se rechaza la decisión antigua, la tarjeta siguiente no hereda evidencia y el uso sigue consumido; si era legítima, se pierde la oportunidad. Cambios docentes de duración o interrupciones también pueden alterar el cierre, por lo que no se deben mezclar con el ensayo normal.
- No se devuelve un uso por dejar vencer una tarjeta ya consultada. Evidencia y consulta están vinculadas al ID de esa tarjeta, no a la siguiente.

Fuentes: [`verifyIdentity`](../server/engine.ts#L3093), [`decideIdentity` y `expireIdentity`](../server/engine.ts#L2989), [snapshot privado de evidencia](../server/engine.ts#L4107), [botones y margen del cliente](../client/games/IdentityGame.tsx#L200), [pruebas de límites, expiración forzada y pausa](../tests/identity-p4.test.ts#L319).

### 2.4 Precisión, resultado e impostor

Para todos los defensores, el motor calcula:

```text
precisión = 100 × Σ(legítimas autorizadas)
                 / Σ(legítimas mostradas + puntos malos por inactividad)
```

Redondea a dos decimales; con denominador cero devuelve 0. Una legítima mostrada ya entra en el denominador aunque expire, sea rechazada o quede sin decidir al cierre. Autorizar correctamente cuatro legítimas con dos puntos malos da **66,67 %**, frente a **100 %** sin esos puntos; no es un porcentaje de todas las decisiones correctas.

Dejar expirar una falsa no crea infiltración; autorizar una falsa sí. Tres infiltraciones comprometen una dependencia defensora. El objetivo del impostor es comprometer `min(3, defensores activos)` servicios: 2 en una partida de tres personas y 3 en grupos de cuatro a seis con todos activos. Si lo alcanza, gana incluso con una precisión legítima alta. Si no, al agotarse el tiempo el equipo gana con precisión ≥70 %; por debajo queda **inconclusa**, sin convertir automáticamente esa falta de punto en victoria del impostor. Los puntos malos no crean infiltraciones ni otorgan puntos directos al atacante.

El impostor conserva inyecciones normales con cooldown de 10 s y una avanzada, disponible tras resolver su expediente y llegar al segundo tercio; esa avanzada comparte cooldown y no reemplaza la tarjeta activa. Ampliar inactividad mejoraría el componente de precisión defensora, pero no eliminaría estas capacidades. Su efecto sobre el comportamiento humano y las oportunidades de engaño sigue sin medirse.

Fuentes: [métrica](../server/engine.ts#L3637), [cierre y prioridad del compromiso](../server/engine.ts#L3527), [inyecciones y expediente](../server/engine.ts#L3154).

### 2.5 ¿La evidencia permite una decisión razonada?

**Disponibilidad técnica, comprobada:** UI compara retrato, nombre, empleado/dependencia, folio, símbolo, nivel y vigencia. La consulta privada devuelve titular, nivel permitido, autorización y bitácora. Las avanzadas pueden copiar exactamente la credencial; el parecido visual por sí solo no permite identificar su falta de autorización. Hay legítimas urgentes: rechazar cualquier urgencia tampoco es una regla suficiente. Los snapshots no entregan `legit`, variante ni respuesta interna al alumno o proyector.

**Comprensión humana, aún desconocida:** el catálogo usa autorización suspendida, ausencia de turno, uso del folio en otro acceso y salida sin reingreso. «SUSPENDIDA» es una señal explícita. En cambio, «Folio usado hace 2 min en otro acceso» requiere contexto sobre acceso simultáneo/distancia, y «Salida registrada 19:05 · sin reingreso» puede interpretarse como alguien que justamente está solicitando reingresar. El motor las clasifica como avanzadas falsas, pero esas frases no garantizan por sí solas que un alumno comprenda la contradicción. Es un **riesgo semántico/pedagógico**, no un error de cálculo demostrado.

Antes de culpar al reloj, observar si el alumno identifica la línea relevante, entiende su relación con el acceso solicitado y distingue credencial vigente de autorización para esa acción. No dar puntos pedagógicos solo por ganar la ronda. El docente debe pedir una explicación al cierre, sin convertir durante la partida cada bitácora en una etiqueta de «falsa» o revelar al impostor.

Fuentes: [campos de la credencial](../client/games/IdentityGame.tsx#L39), [registro y variantes](../shared/identityCatalog.ts#L203), [briefing actual](../client/components/Briefing.tsx#L26), [pruebas de comparación visual y consulta](../tests/identity-p4.test.ts#L500).

## 3. Fase B — Protocolo breve de ensayo humano

**Estado: preparado, no ejecutado.** Un grupo de 3–6 estudiantes; apodos genéricos del juego, sin nombres en la hoja. Un docente facilita; para seis pantallas conviene un segundo observador. Si no puede observarse un dato, escribir **NR**, nunca estimarlo como cero. No grabar pantallas ni exportar logs con nombres; no instalar telemetría.

1. **Preparación, 2 min:** comprobar conexiones, fijar 120 s / 70 %, mantener la configuración durante el ensayo y acordar qué contará como decisión, expiración y consulta. Anotar solo cantidad de participantes y dispositivos por tipo. Usar las instrucciones actuales; no adelantar respuestas del registro. Si se aísla Identidad avanzando/interrumpiendo misiones anteriores desde el docente, anotarlo: no reproduce la fatiga del recorrido completo.
2. **Primera lectura:** al mostrar la primera tarjeta, pedir una señal discreta cuando entiendan qué deben comparar y otra cuando hayan terminado de comparar campos. Registrar solo el intervalo aproximado en que al menos la mitad del grupo alcanza cada señal: <3 s / 3–5 s / >5–8 s / >8 s / NR. Son umbrales grupales de observación, **no tiempos individuales ni medianas exactas**. No pausar para esperar esas señales.
3. **Misión de 120 s:** observar sin ayudar a decidir. Por tercio, hacer marcas agregadas para consultas, expiraciones y señales de confusión. No mostrar aciertos privados ni inferirlos en vivo. Si hay pausa o desconexión, registrar el incidente y separar ese tiempo de los segundos de misión.
4. **Cierre, 3–5 min:** tras el desenlace, contar localmente las decisiones incorrectas y expiraciones en los registros existentes, si están disponibles. Copiar solo totales; separar defensores de todos los participantes cuando la métrica lo requiera. La suma de inactividad de todos los roles no sirve para reconstruir la precisión defensora. Si no se puede identificar un dato, NR. No asumir que una diferencia en precisión equivale a un número de decisiones incorrectas.
5. **Dos preguntas:** «¿Qué evidencia te hizo decidir?» y «¿Hubieras decidido igual con más tiempo?». Pedir clasificación voluntaria y anónima del motivo de error: comprensión, presión temporal, mixto, problema técnico o no sabe. Puede marcarse en papeletas sin nombres y sumar al instante. Cada participante indica un motivo principal o «sin error/NR»; esos autoinformes no se suman como si fueran cantidad de decisiones incorrectas. Separar autoinforme de interpretación del observador; no diagnosticar causas solo por ver una expiración.
6. **Dificultad:** recoger histograma agregado 1–5 (1 muy fácil, 5 muy difícil), sin conservar respuestas vinculadas a personas. Verificar al menos verbalmente la lección: una coincidencia visual no garantiza autorización.

El primer piloto es exploratorio; 3–6 personas no permiten afirmar un balance óptimo ni generalizar a todo el alumnado. Un segundo ensayo contextual puede recorrer el juego completo. Para comparar versiones en alumnos haría falta aprobar primero una alternativa aislada y alternar el orden entre grupos; no atribuir una mejora de la segunda partida al cambio sin considerar aprendizaje.

### Hoja imprimible de observación — sin datos personales

> Plantilla vacía. NR = no registrado. Guardar únicamente esta hoja agregada; no nombres, apodos, servicios asociados a personas, capturas, IP ni respuestas individuales.

| Preparación | Registro |
| --- | --- |
| Código arbitrario de sesión, sin fecha de nacimiento ni identificadores | ______ |
| Participantes / defensores | ___ / ___ |
| Dispositivos: teléfonos / computadoras | ___ / ___ |
| Recorrido completo o Identidad aislada | ______ |
| Confirmación: 120 s, 70 %, dos verificaciones | □ |
| Comprensión de primera tarjeta, al menos mitad del grupo | □ <3 s · □ 3–5 s · □ >5–8 s · □ >8 s · □ NR |
| Comparación de campos terminada, al menos mitad del grupo | □ <3 s · □ 3–5 s · □ >5–8 s · □ >8 s · □ NR |

| Registro agregado | Inicial 0–40 s | Ágil 40–80 s | Crítico 80–120 s | Total |
| --- | --- | --- | --- | --- |
| Verificar aceptados, todos los roles | ___ | ___ | ___ | ___ |
| Verificar no disponible por margen/agotamiento (observado, sin inferir) | ___ | ___ | ___ | ___ |
| Tarjetas expiradas sin decidir, defensores | ___ | ___ | ___ | ___ |
| De ellas, legítimas, si puede contarse al cierre | ___ | ___ | ___ | ___ |
| Decisiones incorrectas: falsas permitidas + legítimas rechazadas, defensores | ___ | ___ | ___ | ___ |
| Incrementos de inactividad, defensores | ___ | ___ | ___ | ___ |
| Incrementos de inactividad, todos los roles, separados de precisión | ___ | ___ | ___ | ___ |
| Pausas/desconexiones: cantidad; tiempo real aparte | ___ | ___ | ___ | ___ |

Si el panel solo permite obtener un acumulado al cierre, llenar únicamente Total; no repartirlo arbitrariamente entre tercios.

| Cierre y explicación | Registro agregado |
| --- | --- |
| Precisión publicada / resultado de misión | ___ % / ___ |
| Legítimas mostradas / autorizadas, si disponibles | ___ / ___ |
| Dificultad: cantidad de respuestas 1 / 2 / 3 / 4 / 5 / NR | ___ / ___ / ___ / ___ / ___ / ___ |
| Motivos autoinformados: comprensión / tiempo / mixto / técnico / no sabe / sin error-NR | ___ / ___ / ___ / ___ / ___ / ___ |
| ¿Explican por qué igualdad visual no implica autorización? cantidad sí / no / NR | ___ / ___ / ___ |
| Frases o campos confusos, sin citar personas | ____________________ |
| Diferenciar observación de hipótesis del docente | ____________________ |

## 4. Fase C — Comparación reproducible de hipótesis

### 4.1 Método y alcance

[Script de análisis](../scripts/analysis/e3-identity-pressure.ts), [pruebas de caracterización](../tests/e3-identity-pressure.test.ts), [resultados JSON](e3/escenarios-identidad.json).

Se ejecutan **60 trazas del motor real sin modificar**: 3/4/5/6 participantes × tres semillas deterministas (7, 91, 2026) × cinco actores sintéticos. Se avanzan pasos de 100 ms. Sobre cada traza se reproducen cuatro políticas de inactividad: **240 evaluaciones**, no 240 partidas humanas. Las reglas alternativas existen solamente en el cálculo offline; no se parchea el motor, no hay nuevas opciones del docente ni dependencias. La política actual se contrasta con contadores reales de los 270 actores sintéticos, precisión y ganador; si no coincide, el script falla.

Las decisiones, tarjetas, consultas, infiltraciones, expiraciones y tiempos son los de la traza original. Solo se recalculan penalizaciones, precisión y resultado con las hipótesis. Esto permite aislar el efecto aritmético, **no** predecir cómo cambia la conducta de estudiantes o del impostor al recibir menos presión.

Los oráculos conocen la clasificación interna exclusivamente para aislar el tiempo: deciden correctamente a los 3, 6 o 9 s desde cada activación y gastan sus dos consultas en las primeras tarjetas, iniciándolas al segundo 1. No representan alumnos ni una estrategia aconsejada. El actor visual compara solo campos; el de «permitir todo» ignora evidencia. En esos dos casos hay un impostor programado que envía falsas normales al salir del cooldown, resuelve su expediente y usa la avanzada desde t=40 s si la partida sigue abierta. No se exportan tokens, tarjetas, nombres ni logs de actores. No se modelan red, latencia, tamaño de pantalla, desplazamiento ni carga de lectura humana. Los plazos empiezan en el servidor; la recepción tardía puede reducir el tiempo visible. Los 1,5 s mínimos tras consultar son margen de servidor, no una garantía de 1,5 s completos de lectura en el teléfono. Registrar incidentes técnicos en el piloto sin confundirlos con comprensión.

### 4.2 Políticas hipotéticas

| Política | Definición exacta | Consecuencia esperable y riesgo |
| --- | --- | --- |
| Actual 5 s | Primera cuenta y recurrencia de 5 s; reinicio por acción válida; expiración no reinicia. | Mantiene toda la presión actual. Lectura no equivale a actividad del servidor. |
| Ventana 8 s | Cambia solo la ventana inicial/recurrente y su reinicio a 8 s. Sin tolerancia nueva al cambiar tarjeta. | Reduce castigo de lectura; conserva herencia del vencimiento entre tarjetas expiradas y no resuelve expiración de 6 s. Podría favorecer precisión defensora, sin quitar infiltraciones. 8 s es un valor de comparación, no un ajuste aprobado. |
| Tolerancia inicial 2 s por tarjeta | Al cambiar ID, primera fecha = activación +7 s; luego cada 5 s. Una acción fija `max(ahora+5 s, activación+7 s)`. | Diferente de ampliar toda la ventana. Evita herencia inmediata y puede eliminar penalizaciones en tarjetas críticas que expiran antes de 7 s. Es un cambio de balance más amplio de lo que su nombre sugiere. |
| Eximir solo consulta pendiente | Mantiene 5 s y sus fechas; omite cobro si la consulta sigue pendiente, sin crédito ni prórroga posterior. | No tiene efecto en consultas legales: ya reinician 5 s y terminan en 1,5 s. «Congelar la cuenta y devolver 1,5 s después» sería **otra** hipótesis, no evaluada aquí. |

Ninguna hipótesis cambia 120 s, 70 %, duración de tarjetas, número de verificaciones, contenido, infiltraciones ni cooldowns. No se garantiza victoria defensiva.

### 4.3 Resultados sintéticos

Cada fila reúne 12 partidas sintéticas (cuatro capacidades × tres semillas), con 42 defensores en total. Precisión es la **media de las 12 métricas de partida**, no una tasa estimada de aprendizaje. Penalizaciones y expiraciones son totales agregados de defensores. Las expiraciones incluyen legítimas y falsas; los casos individuales del JSON las desglosan. Los tres oráculos tuvieron **cero decisiones incorrectas ejecutadas**, pero sí pueden dejar tarjetas sin decidir.

| Actor | Política | Precisión media | Puntos malos | Expiradas | Victorias defensoras / 12 |
| --- | --- | ---: | ---: | ---: | ---: |
| Oráculo 3 s | Actual 5 s | 97,62 % | 0 | 0 | 12 |
| Oráculo 3 s | Ventana 8 s | 97,62 % | 0 | 0 | 12 |
| Oráculo 3 s | Tolerancia por tarjeta | 97,62 % | 0 | 0 | 12 |
| Oráculo 3 s | Eximir consulta pendiente | 97,62 % | 0 | 0 | 12 |
| Oráculo 6 s | Actual 5 s | 25,83 % | 882 | 252 | 0 |
| Oráculo 6 s | Ventana 8 s | 52,39 % | 168 | 252 | 0 |
| Oráculo 6 s | Tolerancia por tarjeta | 69,11 % | 0 | 252 | 4 |
| Oráculo 6 s | Eximir consulta pendiente | 25,83 % | 882 | 252 | 0 |
| Oráculo 9 s | Actual 5 s | 11,29 % | 840 | 420 | 0 |
| Oráculo 9 s | Ventana 8 s | 14,12 % | 588 | 420 | 0 |
| Oráculo 9 s | Tolerancia por tarjeta | 16,96 % | 420 | 420 | 0 |
| Oráculo 9 s | Eximir consulta pendiente | 11,29 % | 840 | 420 | 0 |

Las partidas sin victoria defensora de esos oráculos terminaron inconclusas, **no** como victoria automática del impostor. Todas duraron 120 s. Que el oráculo de 3 s no alcance 100 % se explica por legítimas ya mostradas aún sin autorizar al cierre; «sin expiraciones» no significa «todas resueltas».

| Prueba de estrategia / impostor | Resultado actual y bajo las cuatro políticas |
| --- | --- |
| Solo comparación visual, 3 s, con ataques | 96,71 % medio; 54 decisiones incorrectas agregadas; 12/12 victorias defensoras. Las falsas avanzadas pueden entrar sin llegar al umbral de compromisos. Ganar no acredita la lección pedagógica. |
| Permitir todo, 3 s, con ataques | 98,06 % medio, pero 12/12 victorias del impostor por compromisos, con cierres a los 18–24 s. Demuestra la prioridad de infiltraciones frente a la precisión legítima. |

Estas estrategias rápidas no generaron inactividad: por eso las alternativas dieron el mismo resultado. No prueban que el impostor tenga idéntica probabilidad de ganar frente a personas con otros tiempos y decisiones. La capacidad de comprometer servicios permanece; su balance humano está pendiente.

### 4.4 Lectura de los escenarios

- Ampliar únicamente la inactividad puede mejorar precisión, pero no devuelve tarjetas ya expiradas. El caso de 6 s evidencia precisamente las dos presiones distintas.
- La tolerancia por tarjeta tiene un impacto mayor y cambia resultados: en este experimento produce cuatro victorias defensoras donde antes había cierres inconclusos. No debe presentarse como un arreglo neutro.
- Eximir solo los 1,5 s de consulta pendiente no resuelve el problema de **leer la evidencia después** de recibirla.
- No se puede convertir la media sintética en «porcentaje de alumnos que ganará» ni afirmar que 8 s es óptimo. Tampoco corresponde bajar el 70 % para hacer pasar estos escenarios.

## 5. Pruebas y reproducción

```sh
pnpm install --frozen-lockfile
pnpm exec tsx scripts/analysis/e3-identity-pressure.ts > /tmp/e3-identidad-repro.json
diff -u docs/e3/escenarios-identidad.json /tmp/e3-identidad-repro.json
pnpm exec tsx --test tests/e3-identity-pressure.test.ts
pnpm check
pnpm test
pnpm build
git diff --check
```

La suite de transporte requiere assets compilados; en un checkout completamente nuevo ejecutar primero `pnpm build` como preparación. La validación final vuelve a ejecutar check, test, build y diff en ese orden.

Las seis pruebas nuevas verifican: duración y cruce de tercios; inactividad heredada tras expiración; reinicio, rechazo y deduplicación; consulta con margen exacto y pausa; fórmula y puntajes sin infiltraciones inventadas; y paridad del replay en las 60 trazas. Las pruebas existentes cubren expiración forzada durante consulta, privacidad, límite de dos usos, final de misión, desafíos e inyecciones. El documento no usa como prueba un mero cambio de constantes en el código.

**Verificación ejecutada:** `pnpm check` correcto; `pnpm test` **221/221**; `pnpm build` correcto (conserva el aviso existente de chunk >500 kB); `git diff --check` correcto. La segunda generación del JSON coincide exactamente con el archivo versionado (`diff -u`, sin diferencias).

## 6. Recomendación y condiciones de decisión

**Ahora:** mantener las reglas en producción y ejecutar el piloto. Aclarar verbalmente en la preparación del ensayo la diferencia entre reloj de tarjeta, inactividad y vigencia impresa, sin introducir un nuevo briefing obligatorio ni enseñar respuestas. Separar comprensión del registro, presión temporal y éxito por puntos en la evaluación docente.

**Tras el piloto:**

- Si se entiende la evidencia y las expiraciones son escasas, pero aparecen puntos malos mientras comparan con atención, considerar una comparación aprobada de **una sola variable**, ventana de inactividad 5 s frente a un valor mayor justificado por lo observado. No asumir que el 8 s sintético será el valor final.
- Si predominan expiraciones en tarjetas críticas, ampliar solo inactividad no resuelve ese límite. Cualquier propuesta de vigencia necesita otra justificación y pruebas, conservando o justificando explícitamente los 120 s; no aplicarla junto con otros cambios sin poder aislar su efecto.
- Si predominan interpretaciones equivocadas de bitácora o de autorización vigente, preparar una aclaración pedagógica/contextual separada del balance. No atribuir ese problema a lentitud ni convertir el registro en un veredicto automático.
- No implementar la exención de consulta pendiente como supuesto alivio: el análisis muestra que, con la definición evaluada, ya no hay cobro durante una consulta legal.

**Puerta de aprobación:** cualquier cambio de ventana, tolerancia, vigencia o tratamiento de consulta se presenta en una rama/PR de balance separado, con datos agregados del piloto, hipótesis y criterio de evaluación declarados antes de comparar. Requiere aprobación antes de integrarse; no cambiar duración de misión, precisión objetivo ni desafío del impostor para garantizar una victoria. Los ajustes de claridad se revisan por separado. Este trabajo no incluye corrección funcional, merge, despliegue ni reinicio de los servicios activos.
