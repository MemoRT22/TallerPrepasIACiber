# Audio opcional del comunicado (P4)

El juego **no incluye** ningún archivo de audio y funciona completo sin él: el
comunicado siempre se muestra con su transcripción.

Si quieres usar audio:

1. Graba una voz **propia** o usa una voz con **autorización escrita** de la
   persona. No se admiten clonaciones de voz sin consentimiento ni voces de
   terceros.
2. Guarda el archivo como `public/audio/comunicado-direccion.mp3` (o cambia
   `IDENTITY_EVENT.audioSrc` en `shared/identityCatalog.ts`). Debe leerse la
   misma transcripción que aparece en pantalla.
3. Servirlo con tipo `audio/*` (lo hace el servidor estático). El control
   «Activar audio» solo aparece en las terminales si el archivo existe; nunca
   se reproduce solo y «Silenciar» lo detiene al instante.

No se llama a ninguna API de voz ni se necesita conexión externa.
