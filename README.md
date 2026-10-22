# Cancún bajo ataque

Simulación educativa de ciberseguridad para **3 a 6 jugadores**, un administrador y una pantalla pública. React, TypeScript, Tailwind CSS, Three.js, Express y Socket.io. No se realizan ataques reales ni se utiliza o entrena IA.

## Ejecución

Node.js 22 y pnpm 11.25.0:

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Un único listener en `0.0.0.0:3000` (o `PORT`) sirve HTTP y Socket.io; Vite corre como middleware de Express en desarrollo.

```bash
pnpm check
pnpm test
pnpm build
pnpm start
```

Compilación: `dist/client` y `dist/server.js`. Dockerfile reproducible con lockfile y endpoint `/api/health`.

## Control y acceso

El administrador abre su **enlace privado**. La ruta `/docente` por sí sola no permite crear experiencias: el servidor valida la capability de operador en `CANCUN_ADMIN_KEY`. En la ejecución local, si no se suministra, se genera y conserva en `.delivery/operator.json` con permisos `0600`. El enlace de operador usa `/docente#access=SECRETO`; el secreto solo se conserva en la sesión del navegador y no se imprime en consola ni forma parte del frontend o Git. Para una publicación con instancias reemplazables, declarar `CANCUN_ADMIN_KEY` como secreto estable del servidor.

Un administrador que ya posee acceso válido a una sala también puede crear otra. La creación se rechaza desde conexiones identificadas como jugador o espectador, aun si intentan enviar comandos administrativos. No hay cuentas personales, contraseñas de estudiantes ni datos obligatorios más allá de un nombre/apodo.

| Destinatario | Acceso | Funciones |
| --- | --- | --- |
| Operador | `/docente#access=SECRETO` | Crear experiencias y controlar la sala propia |
| Administrador de sala | `/docente#room=CODIGO&token=SECRETO` | Asignar, iniciar, pausar, ajustar, repetir, interrumpir y avanzar |
| Jugador reservado | `/jugar/CODIGO/NUMERO#invite=SECRETO` | Su terminal y sus decisiones |
| Jugador libre | `/jugar?code=CODIGO` | Ocupar un puesto libre antes de asignar |
| Pantalla | `/pantalla/CODIGO` | Ciudad, estado de servicios y resultados, sin acciones de juego |

Los fragmentos de URL no se envían en solicitudes HTTP. Tras el acceso se eliminan de la barra. Las sesiones de sala se conservan por audiencia/código en almacenamiento local, con tolerancia al bloqueo de almacenamiento en Preview. Un acceso privado es una capability: compartirlo autoriza esa sesión. Abrirlo en otro dispositivo sustituye su conexión previa; no es autenticación empresarial de identidad personal.

## Flujo de la experiencia

En **Nueva experiencia · elegir jugadores**, selecciona de 3 a 6 y confirma. Abre **Abrir ciudad con QR** en el proyector: sobre la maqueta aparece un QR que lleva a `/jugar?code=CODIGO`, el código y el progreso de conectados. Cada persona escanea y escribe su nombre. La confirmación del administrador autoriza el primer arranque automático; una sala elegida para seis espera a los seis, no empieza con tres.

Con el grupo completo realmente conectado y el administrador presente, el servidor asigna los roles una sola vez y el QR desaparece. El roster queda congelado. Siempre hay un único impostor estable; todos, incluido él, son responsables de un servicio. Su identidad de cobertura y tarea normal no lo distinguen públicamente. El rol privado se consulta mediante un botón en su terminal.

El primer juego muestra sus instrucciones durante **20 segundos sincronizados**; después la pantalla anuncia **AMENAZA DETECTADA**, cuenta **5 segundos controlados por el servidor** y solo entonces admite acciones. Lectura y cuenta no consumen tiempo de ronda ni tarjetas. El administrador puede pausar lectura/cuenta y desactivar el inicio automático antes de completar el grupo. La salida de un jugador NO pausa lectura, cuenta ni ronda; si desaparece el administrador durante el preinicio, se conserva la pausa de protección de su control. El monitor y las terminales no pueden adelantar el reloj ni asignar roles.

Las salas anteriores pueden habilitar **Mostrar QR e iniciar con grupo completo** en el panel. Sin esa habilitación mantienen el modo manual: con al menos tres participantes y todos los que entraron conectados se asignan roles aunque sobren puestos, y el administrador da la señal tras leer. **Los minijuegos posteriores siguen esperando la señal del administrador**; el arranque automático solo reúne al grupo para el primero.

El administrador puede pausar contador o ronda, reanudar, ajustar parámetros en preparación o pausa, repetir una experiencia quitando su resultado o terminarla sin puntos. Cada transición vuelve a las instrucciones, esperando una señal nueva. Después de asignar, puede avanzar e iniciar aunque no estén todas las terminales conectadas. Una desconexión se muestra aparte y no se considera sabotaje; su terminal deja de recibir simulación nueva sin reescribir decisiones ni métricas previas.

Si un jugador regresa durante la misma ronda, se autentica con su token y ve **Te reincorporas en el siguiente juego**: conserva nombre, servicio y rol, pero el servidor no acepta acciones de esa ronda. Al pasar o repetir el siguiente juego se habilita su terminal. **Salir de mi terminal** conserva el acceso y ofrece **Reconectarme**, a diferencia de borrar el acceso de un dispositivo. Una caída involuntaria mantiene la reconexión Socket.io. Reset total sí revoca esos tokens.

Al terminar los tres minijuegos se realiza recuperación; después el administrador abre votación individual privada con razón y revela tras recibir los votos de quienes están conectados. Los ausentes no bloquean el cierre ni reciben votos inventados. El registro detallado se descarga desde el administrador; la pantalla solo muestra el resumen final, identidad y marcador.

## Reglas

| Fase | Tiempo predeterminado | Victoria impostor | Victoria equipo si no gana el impostor |
| --- | --- | --- | --- |
| Correos | 150 s | 3 correos falsos propios aceptados por defensores | ≥80% correctos sobre todos los recibidos; pendientes penalizan |
| Saturación | 90 s | `min(3, cantidad de defensores)` servicios denegados | Menos de ese límite y ≥70% de azules procesados |
| Identidades | 120 s | `min(3, cantidad de defensores)` servicios con 3 infiltraciones cada uno | ≥70% de tarjetas legítimas mostradas autorizadas |
| Recuperación | 120 s | Sin sabotaje técnico | Todas las partes César recuperadas desde sus sesiones |

Cada victoria técnica suma un punto; inconclusa o interrupción suma cero. Recuperación y votos son separados del marcador. Bloqueos se restablecen al siguiente minijuego, no roles. Autoridad de reloj, clasificación, cooldowns, impacto y cierre exclusivamente del servidor; eventos idempotentes y acciones solo en etapa `playing`.

Correo: cuatro mensajes iniciales; recepción/envío cada 20 s y congelación 20 s antes del cierre. La ronda automática entrega diez decisiones si la bandeja no se atiende; los envíos de jugadores pueden añadir presión. Solo remitente completo y asunto, plantillas ficticias sin texto libre, dominio de referencia `cancun.example`, sin feedback inmediato de corrección.

El hacker abre **Mi rol secreto** y **Enviar un correo**, elige **Correcto** o **Malicioso**, la plantilla y otro servicio. Los defensores solo pueden enviar oficiales; ocultar el rol vuelve al modo correcto y limpia la plantilla privada. Ambos tipos conservan el mismo enfriamiento y cierre de envíos.

Saturación: diez segmentos, viaje de 4 s, liberar uno por 5 s consecutivos sin impacto; círculos azules seguros y cruces naranjas sospechosas. Los datos internos conservan el tipo `red` para cruces. Tres tramos de 30 s con frecuencias 2,0/1,5/1,1 s y proporción 60/40; esperar cuando solo hay tráfico azul no cuenta como inactividad. Tocar una cruz siendo impostor genera una adicional para un defensor activo. **En los últimos 10 segundos genera tres en total, distribuidas entre los defensores disponibles**, no tres por cada defensor. Mantienen viaje normal e IDs distintos, sin mostrar origen; tocar azul no genera ataque. La saturación simulada de su propio servicio no le impide seguir jugando.

Identidad: comparar avatar/código de cuatro dígitos/símbolo. Plazos 10/8/6 s por tramos, dos pendientes máximo más la activa; solicitudes impostoras cada 10 s sustituyen un futuro automático sin desplazar la activa. Expirar impide acceso pero pierde una legítima. Bloqueo interno inmediato al tercer falso permitido; estado público por pulso de 10 s y cierre.

Recuperación César +3 A–Z: con dos defensores, `CANCUN RECUPERA` / `EL CONTROL`; tres, `CANCUN` / `RECUPERA` / `EL CONTROL`; cuatro, `CANCUN` / `RECUPERA` / `EL` / `CONTROL`; cinco añade `TOTAL`. Se valida la propia sesión con reintentos; impostor tarea auxiliar sin alterar el mensaje. César es histórico, no seguridad moderna.

## Monitor y ciudad 3D

La pantalla no ofrece navegación de salas ni inicio/pausa. Presenta ciudad grande y rótulos **En línea / En riesgo / Fuera de línea**, derivados de decisiones/carga, no una alerta general solo por comenzar. Riesgo de correos y credenciales se agrega en pulsos para no mostrar si acertó una tarjeta concreta; DDoS responde a carga visible. Se indican por separado las terminales desconectadas. La proyección pública no contiene roles, tokens, nodos, bandejas, credenciales, origen de ataques o logs antes de la revelación. El impostor usa el mismo tratamiento visual de servicio para su cobertura.

La maqueta low-poly original incluye minitorres eléctricas con cables/transformadores, torre y depósitos de agua, autobuses y terminal, antena y parabólicas, hotel y piscina, palacio municipal y fuente. Costa/laguna evocan Cancún sin ser cartografía exacta. Rótulos azules operativos, naranjas en riesgo y aviso oscuro de caída; edificios desaturados al fallar y restaurados al recuperarse. Las instalaciones no ocupadas se ocultan tras asignar el roster.

Se puede rotar, acercar y restablecer la cámara sin afectar el juego. No hay botón de pausa ambiental en la pantalla. Se reduce animación con la preferencia del dispositivo y al ocultar pestaña. Carga 3D bajo demanda, geometría agrupada, liberación completa de GPU y fallback accesible si falta WebGL.

Interfaz naranja/azul, texto breve y botones grandes. Marcas oficiales Anáhuac Cancún y Artek alojadas localmente; fuentes en `public/partners/SOURCES.md`. Su presencia no añade afirmaciones de patrocinio.

## Arquitectura y límites

`shared/types.ts`: contrato público/privado y etapas. `server/engine.ts`: reglas, reloj y snapshots. `server/index.ts`: autorización de transporte, frontend y restauración local opcional de invitaciones. `client/pages`: audiencias separadas. `client/components/Briefing.tsx`: instrucciones y contador. `client/games`: mecánicas. `client/three`: maqueta. `tests`: reglas, permisos, sincronización, UI y 3D. `public/manus-routes.json`: declaración de páginas.

**Partidas en memoria de una sola instancia.** Reiniciar, suspender o desplegar pierde acciones, sesiones de jugador y roles de la partida, no hay persistencia duradera ni réplicas coordinadas. En el sandbox, si existe `.delivery/room.json`, se pueden restaurar los accesos de esa sala **solo a una preparación vacía**, no simular una partida recuperada. Participantes deben volver a entrar y se asignan roles nuevos. Archivos privados `.delivery/` no se incluyen en Git. Salas inactivas caducan a las seis horas. Vista previa no equivale a publicación permanente.

Antes de uso real, pilotear con 3 y 6 dispositivos, anunciar metas/ajustes y revisar balance. No introducir datos sensibles en apodos o votos. Referencia técnica: [recuperación de conexión Socket.io](https://socket.io/docs/v4/connection-state-recovery).

## Reiniciar para otro grupo
En los controles principales del administrador, **Reiniciar toda la actividad** solicita confirmación. Al elegir **Reiniciar y sacar a todos**, se revocan las sesiones personales, se quitan nombres/roles/acciones, se borra todo el marcador y las rondas, recuperación, votos y registro; la sala queda vacía. La pantalla y el administrador permanecen conectados. Se conservan código, invitaciones de terminales y parámetros guardados. Las terminales vuelven al ingreso con aviso y sin el nombre anterior. Los jugadores desconectados también pierden su token; deben entrar explícitamente para el grupo nuevo. No es lo mismo que **Repetir esta experiencia**, que mantiene al grupo y sus roles. La limpieza no se puede deshacer: descarga el registro antes si necesitas conservarlo. No es necesario reiniciar el servidor ni crear otra sala para cambiar de grupo.

### Comparación de credenciales
Cada solicitud cambia el perfil de la credencial oficial y de su copia presentada. Las legítimas coinciden en foto, código e icono; las falsas alteran uno de los tres con diferencia observable. Cada terminal recibe una mezcla de dos legítimas y una falsa por bloque, con orden barajado; las falsas alternan los tres tipos de cambio. La pareja se actualiza por ID después de decidir o expirar, sin señalar la respuesta correcta. La referencia siempre está a la izquierda y la presentada a la derecha.

### QR de incorporación en la ciudad
Durante la incorporación, el QR sobre la ciudad contiene únicamente el enlace público de juego con código, nunca una invitación privada ni el acceso docente. Se oculta al asignar los roles y no reaparece si se desconecta alguien durante la ronda. Al reiniciar toda la actividad vuelve para el siguiente grupo con el mismo código; se conserva también el modo de arranque elegido. Si no puede generarse la imagen, el código y el enlace de ingreso permanecen visibles. La pantalla pública sigue sin poder iniciar o pausar.

### Panel único del administrador
La ruta `/docente` y el título **Panel de administrador** permanecen durante preparación, juego y cierre. **Cantidad de jugadores** aparece siempre arriba: elige de 3 a 6 y confirma para aplicar el cupo a la misma sala y mostrar el QR, sin cambiar el código ni los enlaces. Una vez asignados los roles se bloquea hasta la revelación final, incluso durante pausas o entre minijuegos. Tras la votación y revelación se desbloquea; **Preparar siguiente grupo** confirma la limpieza del grupo anterior y aplica la cantidad nueva conservando sesión, código, invitaciones y parámetros. No elimina el grupo solo por tocar un número. El reinicio total existente también permanece disponible. Si hay un puesto de lobby ocupado fuera del cupo elegido, se rechaza sin expulsarlo silenciosamente.

### Revelación sobre la ciudad
Después de que las personas conectadas voten, el administrador confirma **Revelar al impostor en la ciudad**. El mapa muestra un cartel **IMPOSTOR REVELADO** con su nombre y el servicio en el que se disfrazó; su rótulo y ficha de servicio quedan resaltados, también en la vista accesible. No cambia el estado técnico del servicio por revelar su rol. Antes de ese cierre la identidad y su ID de servicio no se envían en datos públicos; los marcadores desaparecen al preparar otro grupo.

### Inactividad e impacto urbano
En los tres minijuegos puntuables, cada **5 segundos sin una acción válida mientras haya elementos por atender** suma un punto malo de inactividad; si sigue sin responder, suma otro cada 5 segundos. La terminal muestra su contador y el administrador puede consultarlo. No cobra por pausas, instrucciones, cuenta inicial, bandeja/escena vacía, bloqueo, desconexión, espera de reincorporación, recuperación ni votación. Acciones rechazadas o repetidas no evitan la penalización. Se restablece por ronda y al reiniciar el grupo. En las métricas defensoras se añade al denominador de la precisión como fallo adicional; no inventa correos maliciosos, infiltraciones, denegaciones ni victorias del hacker. No revela si una decisión concreta fue correcta.

La ciudad conserva su maqueta, cámara, rótulos y revelación final. Añade población anónima low-poly: fallos de energía oscurecen la iluminación; problemas de movilidad producen tráfico lento o un embotellamiento; agua y ayuntamiento muestran vecinos esperando en la calle; comunicaciones, personas buscando señal; turismo, filas de visitantes. La intensidad responde al estado público En riesgo/Fuera de línea, no al rol ni a la conexión de una persona. Al restaurarse los servicios se normalizan iluminación, tránsito y filas. Las leyendas también describen el problema en la vista accesible sin WebGL.
