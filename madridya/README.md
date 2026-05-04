# MadridYa – Guía de instalación

## Estructura del proyecto
```
madridya/
├── index.html        ← Archivo principal
├── css/
│   └── styles.css    ← Todos los estilos
├── js/
│   └── app.js        ← Toda la lógica
└── README.md
```

---

## PASO 1 — Añadir tus claves de API

Abre `index.html` con cualquier editor de texto (Bloc de notas, TextEdit, VS Code).

Busca estas dos líneas al final del archivo:

```html
window.MAPS_API_KEY = 'PLACEHOLDER_MAPS_KEY';
window.GEMINI_API_KEY = 'PLACEHOLDER_GEMINI_KEY';
```

Reemplaza `PLACEHOLDER_MAPS_KEY` con tu clave de Google Maps.
Reemplaza `PLACEHOLDER_GEMINI_KEY` con tu clave de Gemini.

También busca esta línea más abajo:
```html
src="https://maps.googleapis.com/maps/api/js?key=PLACEHOLDER_MAPS_KEY&..."
```
Y reemplaza también ese `PLACEHOLDER_MAPS_KEY`.

Guarda el archivo.

---

## PASO 2 — Subir a GitHub

1. Ve a github.com → "New repository"
2. Nombre: `madridya`
3. Público → "Create repository"
4. Sube los archivos:
   - Arrastra `index.html`, la carpeta `css/` y la carpeta `js/` al repositorio
   - Dale a "Commit changes"

---

## PASO 3 — Publicar en Vercel

1. Ve a vercel.com → "Add New Project"
2. Conecta tu repositorio de GitHub "madridya"
3. Dale a "Deploy"
4. En 2 minutos tienes tu web en: `madridya.vercel.app`

---

## Notas importantes

- Las claves de API NUNCA deben subirse a GitHub públicamente.
  Para protegerlas en producción, usa las variables de entorno de Vercel.
- La app funciona con datos de ejemplo si no hay claves configuradas.
- El chatbot usa Gemini Flash 1.5 (gratuito hasta 15 requests/minuto).

---

## Fases siguientes

- **Fase 2**: Integración completa de Gemini para itinerarios personalizados
- **Fase 3**: Panel de administración para editar el prompt
- **Fase 4**: Marketplace con pagos reales (Stripe)
- **Fase 5**: Analytics y métricas de uso
