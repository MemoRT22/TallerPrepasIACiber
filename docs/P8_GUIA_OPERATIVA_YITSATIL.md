# Operación del taller — Instituto Yitsatil

Evento: **30 de octubre de 2026, 10:00, America/Cancun**. Guía vigente para
P0–P8; las descripciones antiguas de reglas del README no sustituyen esta guía
ni el plan maestro. No se desplegó ni fusionó desde P8.

## 1. Antes de salir

- Una laptop con cargador, adaptador HDMI/USB-C probado, cable y proyector.
- Tres a seis teléfonos con batería, cámara para QR y navegador actualizado.
- Wi-Fi compartido con comunicación entre clientes, o URL HTTPS de una única
  instancia ya preparada. La red de invitados puede aislar teléfonos y laptop.
- Código compilado y dependencias instaladas **antes** de depender de una red sin
  internet; no actualizar Node, pnpm o paquetes durante el montaje.
- Guardar una copia local de esta guía, el informe QA y las capturas de evidencia.
  Llevar impresas las preguntas del plan B. No proyectar accesos docentes.
- Confirmar salón, hora, audio opcional desactivado y consentimiento de cualquier
  activo externo. No pedir nombres completos, contraseñas ni datos sensibles.

## 2. Servidor y acceso desde teléfonos

Las partidas viven en memoria de **un proceso**. No usar múltiples réplicas,
reiniciar el servidor en una partida ni dejar que la laptop duerma. El Dockerfile
declara Node 22; el QA ejecutado en la laptop usó Node 26 y pnpm 11.25.0. No se
certificó aquí un contenedor Node 22 ni se instaló otro runtime para el evento.

Desde la carpeta del repositorio, antes del día del taller:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm start
```

El servidor normal escucha en `0.0.0.0:3000` (o `PORT`) y sirve frontend y
Socket.IO juntos. El piloto de QA usa deliberadamente `127.0.0.1:4180`: **ese
enlace de QA no es un despliegue para teléfonos**.

Hay dos opciones, que deben probarse físicamente antes del evento:

1. **LAN local:** laptop y teléfonos en la misma Wi-Fi, puerto TCP 3000 permitido
   por firewall y sin aislamiento de clientes. En macOS, consultar la IP activa
   con `ipconfig getifaddr en0` (si se usa otra interfaz, consultar Ajustes de
   Red). Abrir en la laptop `http://IP-LAN:3000/api/health` y después hacerlo desde
   un teléfono. Debe devolver `{"ok":true}`. Si no, no distribuir el QR todavía.
2. **Hosting previamente autorizado:** una URL HTTPS estable, una sola instancia
   Node persistente, proceso sin suspensión y proxy que permita upgrade WebSocket.
   Configurar `CANCUN_ADMIN_KEY` como secreto del servidor y probar salud,
   incorporación y reconexión desde los teléfonos. No publicar secretos en Git.

No se ha verificado ninguna de esas dos rutas en la red del Instituto. GitHub no
tenía homepage ni registros de deployment al auditar; eso **no demuestra** que no
exista un hosting externo, pero tampoco acredita que haya una URL operativa.
El responsable debe proporcionar la URL/IP y completar la prueba física.

Si no se suministra `CANCUN_ADMIN_KEY`, la ejecución normal crea la clave local en
`.delivery/operator.json` con permisos 0600. El docente la consulta **en privado**
en esa laptop y abre `http://IP-LAN:3000/docente#access=CLAVE`. No enviar el archivo,
la clave ni enlaces con `token`/`invite` al grupo ni al proyector. Conservar el
enlace privado de sala para reconectar el panel.

**Importante para el QR:** abrir también el proyector usando el origen que los
teléfonos alcanzan (`http://IP-LAN:3000` o HTTPS público), nunca `localhost` ni
`127.0.0.1`. El QR toma el origen del navegador. Un QR con localhost dirige cada
teléfono hacia sí mismo y no permite entrar.

Las fuentes de Google son externas y opcionales; hay fuentes alternativas del
sistema. Las reglas, plantillas, retratos ilustrados, QR y ciudad se ejecutan
localmente. No hay llamadas a IA en vivo. El funcionamiento sin WAN sobre la LAN
del salón queda pendiente de ensayo físico; no confundirlo con funcionar sin red.

## 3. Conducción de una partida

1. Abre `/docente` con el acceso privado. Elige **3–6 jugadores** y confirma.
2. Abre **la pantalla pública** en el proyector o una ventana independiente. Usa
   escritorio extendido: solo esa pantalla se proyecta; el administrador no.
3. Cada participante escanea QR y escribe un apodo. Alternativa: enlace público
   `/jugar?code=CODIGO`. No compartir la liga del administrador como alternativa.
4. Comprueba contador de conexiones. Inicio automático: espera exactamente el
   cupo; roles privados, lectura de 20 s y cuenta de 5 s. Manual: desactiva el
   automático en lobby, asigna roles y da la señal cuando hayan leído.
5. Cada teléfono puede abrir **Mi rol secreto** sin mostrarlo al grupo. El
   impostor conserva su servicio y tareas de cobertura durante toda la partida.
6. **Correos (150 s):** recibir, inspeccionar hasta dos veces y decidir. El
   impostor puede enviar plantillas maliciosas; necesita tres aceptaciones propias.
   No dar pistas de clasificación desde el proyector.
7. **DDoS (90 s):** dejar pasar azul, tocar naranja. Defensores: un escudo de 4 s.
   Impostor: patrón privado y una oleada de tres cruces hacia un defensor válido.
8. **Identidad (120 s):** comparar campos; dos verificaciones. La llamada de
   Dirección y las suplantaciones convincentes requieren evidencia del registro,
   no confianza en foto/voz. No abrir ni leer en voz alta el reto del impostor.
9. **Recuperación (120 s):** descifrar y enviar cada fragmento. Si la clave se
   altera, verificar y esperar 3 s. Completa +1 equipo; timeout incompleto +1
   impostor. **Terminar sin puntos** es interrupción, no derrota automática.
10. Después de cada fase técnica, **Preparar siguiente** y **Dar señal e iniciar**.
    Las instrucciones no avanzan solas en las siguientes misiones. La cuenta de
    5 s es adicional a la duración jugable.
11. **Pausar experiencia** congela el reloj de juego y consultas. Resolver la
    incidencia, comprobar conexiones y **Continuar**. No reiniciar el proceso.
12. **Iniciar juicio final y debate**. Conversar sobre señales, no sobre personas.
    Después, **Abrir votación privada**. Cada terminal revisa y confirma un voto.
13. Se fija quién estaba conectado al abrir; desconectarse después no reduce la
    mayoría. Solo defensores elegibles cuentan para el bonus: mayoría estricta
    por el impostor +1 equipo; sin ella +1 impostor. Su voto de cobertura no cuenta.
14. El docente confirma **Revelar al impostor en la ciudad**, aun si quedan
    abstenciones. Verdad 0–3 s, identidad 3–9 s, resultado 9–20 s, reflexión desde
    20 s; completada a 30 s. No se exige una acción para terminar la secuencia.
15. Totales y cinco rubros se muestran separados. El empate no se desempata. La
    estabilidad 0–100 es narrativa, nunca puntuación. Reflexionar sin exponer
    nombres o errores individuales; fue una simulación, no un ataque real.
16. En privado, descargar el registro si se necesita y está autorizado. **Reiniciar
    toda la actividad** y confirmar para otro grupo: borra roles, apodos, puntos,
    votos y memoria. Conserva sala, accesos docentes, ligas y parámetros. No basta
    con recargar el navegador. No preparar nuevo grupo antes de terminar el cierre.

## 4. Agenda propuesta de 20–25 minutos

| Actividad | Reserva docente (no medición con alumnos) |
| --- | ---: |
| Introducción, simulación y reglas de respeto | 3 min |
| QR/conexión y consulta de rol | 3 min |
| Briefing inicial y cuatro cuentas | 40 s de software |
| Misiones a duración completa | 8 min de software |
| Instrucciones/transiciones de las otras tres fases | 2 min |
| Debate oral | 2–3 min |
| Voto (orientativo, sin cierre forzoso) y secuencia | 60–90 s |
| Cierre, aprendizaje y margen para incidencias | 2–3 min |

Total reservado aproximado 22–25 min. Los 480 s son máximos configurados: una
victoria anticipada o completar Recuperación puede cerrar antes. No acelerar los
relojes para afirmar que se cumplieron duraciones. El informe separa tiempo lógico,
tiempo de pared y pausas; la agenda docente todavía no se cronometró con alumnos.

## 5. Contingencias desde una sola laptop

| Incidencia | Respuesta inmediata |
| --- | --- |
| Un teléfono pierde conexión/recarga | No es sabotaje. Conserva enlace/sesión; reconectar. En misión activa espera la siguiente ronda. Mantener al grupo jugando; repetir solo si el docente lo decide. |
| Sale el impostor | Mismo procedimiento; no anunciar su rol ni tratarlo de forma distinta. Recupera sus capacidades según el reinicio de fase, no con una cuenta nueva. |
| Se cae el panel docente | Reabrir su enlace privado en el mismo navegador. No crear otra sala por accidente. La partida activa no se recupera reiniciando Node. |
| Proyector falla | Mantener la partida en teléfonos; recuperar la ventana pública por código. No proyectar el panel al cambiar ventanas. |
| WebGL falla | Seguir con la vista accesible: estados, memoria y desenlace en texto. No reinstalar drivers durante el taller. |
| WAN falla con servidor en LAN | Mantener Wi-Fi local y servidor. Las fuentes pueden cambiar; no cambiar URL ni resetear por ello. Esta ruta debe haberse ensayado antes. |
| WAN falla con servidor remoto | Pausar si el panel responde. No prometer conservar acciones no confirmadas. Si no vuelve en 60–90 s, pasar al plan B. |
| Node/laptop se reinicia | Las partidas en memoria se pierden. Informar con calma; volver a iniciar servidor y una actividad nueva. No prometer reconstrucción de roles/puntos. |
| Ningún teléfono alcanza la URL | No insistir con QR localhost. Comprobar misma red/IP/puerto/aislamiento; si no se resuelve rápido, ejecutar plan B. |

**Plan B sin servidor o sin red:** abrir capturas locales previamente guardadas
desde la laptop (Preview, no una página que necesite red), o continuar oralmente:

1. Presentar dos solicitudes ficticias: una consulta de horario sin pedir datos y
   otra que pide contraseña por urgencia. Preguntar qué evidencia independiente
   buscarían; no usar cuentas o contraseñas reales.
2. Dibujar azul/naranja en papel o pizarra: qué dejar pasar, qué interceptar y
   cuándo gastar una protección única. No afirmar que se ejecutó una partida.
3. Proponer una credencial convincente con autorización suspendida: verificar el
   registro importa más que la apariencia. Enlazar con desinformación/suplantación.
4. Resolver colectivamente un ejemplo César +3 y aclarar que no protege datos
   modernos. Debatir qué señales justifican sospechas, sin acusar a estudiantes.
5. Cerrar con verificar por otro canal, decidir con evidencia y colaborar. Registrar
   «demostración alternativa», no inventar ganador, votos ni métricas de software.

## 6. Puerta de salida para el 30 de octubre

No declarar **LISTO PARA EVENTO** hasta que estén firmados estos puntos:

- [ ] URL/IP alcanzable desde al menos un iPhone Safari y un Android Chrome reales.
- [ ] Red del salón, puerto/WebSocket, QR con origen correcto y pérdida de conexión.
- [ ] Laptop/proyector/cable/duplicación de escritorio y lectura desde el fondo.
- [ ] Ensayo físico con 3 y 6 teléfonos; tiempos docentes y comprensión.
- [ ] Contingencia local descargada/probada y responsable de operar identificado.

Actualmente esos requisitos físicos y de conectividad están **NO PROBADOS**.
La evidencia local de navegador/Socket.IO no los sustituye.
