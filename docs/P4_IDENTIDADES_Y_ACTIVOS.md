# P4 · Identidades, retratos y audio opcional

Guía de mantenimiento para docentes y desarrolladores de la misión
**Identidad robada**.

## Qué se ve hoy

- Las credenciales usan un catálogo local de **ocho personas ficticias**
  (`shared/identityCatalog.ts`): nombre, empleado, dependencia, nivel, folio,
  vigencia e icono.
- Los retratos son **ilustraciones vectoriales** (`client/components/Portrait.tsx`).
  No son fotografías ni imágenes generadas con IA, y la interfaz no las
  presenta como tales. No hay activos de terceros ni peticiones externas.
- El comunicado con «voz» es texto. El audio es opcional y no está incluido.
- No se generan imágenes ni voz en tiempo real, ni se llama a modelos o APIs de
  IA. El taller muestra material preparado de antemano; **no detecta IA en
  vivo**.

## Sustituir los placeholders por retratos sintéticos aprobados

Solo si cumples **todo** lo siguiente:

1. Las imágenes son sintéticas de personas inexistentes (o ilustraciones
   propias), generadas por ti o por una herramienta cuya licencia permita este
   uso. Guarda constancia del generador, la fecha y la licencia.
2. Ninguna persona real aparece en ellas ni se parece a una de forma
   deliberada. Sin fotos de estudiantes, docentes o terceros sin permiso
   escrito.
3. Las optimizas: WebP, 160×200 px, ≤ 15 kB cada una (ocho archivos ≈ 120 kB).

Pasos:

1. Copia los archivos en `public/portraits/` (`retrato-0.webp` … `retrato-7.webp`).
2. Registra cada uno en `PORTRAIT_ASSETS` de `shared/identityCatalog.ts`:

   ```ts
   export const PORTRAIT_ASSETS = {
     0: {
       src: "/portraits/retrato-0.webp",
       provenance: "ai-generated-approved",
       generator: "Nombre y versión de la herramienta",
       license: "Licencia o términos aplicables",
       approvedBy: "Persona que aprobó el uso",
     },
   };
   ```

3. Ese registro hace que el retrato muestre la etiqueta «SINTÉTICO». Sin él, el
   juego sigue usando el placeholder. No agregues entradas para imágenes sin
   permisos verificables.
4. Ejecuta `pnpm check`, `pnpm test` y `pnpm build` en serie. El paquete del
   cliente no crece: los archivos se sirven por separado y con carga diferida.

## Audio opcional del comunicado

Ver `public/audio/README.md`. Requisitos del producto: desactivado por defecto,
activación explícita, botón para silenciar, transcripción visible, sin
reproducción automática, sin conexión externa y sin bloquear la misión si falta
el archivo. Solo se admite una voz con autorización expresa y un archivo
entregado legítimamente; nunca una clonación sin consentimiento.

## Cómo explicarlo al grupo

> Estas imágenes y este comunicado se prepararon antes de la sesión. Una voz o
> una cara convincente no prueba quién es; hay que consultar una fuente
> confiable. No existe una herramienta que detecte con certeza todo contenido
> generado con IA.
