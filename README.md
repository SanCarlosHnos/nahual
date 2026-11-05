# ⚒ Forja

IA local de terminal (TypeScript + Ollama) que construye software completo y **se mejora a sí misma** a partir de tus indicaciones.

## Arrancar

```bash
cd forja
npm install
npm start
```

Para tenerla como comando global (`forja` desde cualquier carpeta, y trabajará en esa carpeta):

```bash
npm link
```

Requiere Ollama abierto. Modelo por defecto: `huihui_ai/qwen2.5-coder-abliterate:14b` (cámbialo con `/modelo`).

## Uso

- Escribe una instrucción normal → Forja planifica, escribe el código, lo compila y corrige errores en la carpeta de trabajo (`proyectos/` por defecto, o la carpeta donde la lanzaste).
- `/mejorar <indicación>` → Forja edita **su propio código**, pasa la verificación (tsc + autopruebas + arranque) y, si todo va bien, guarda un commit y se reinicia con la nueva versión.
- `/deshacer` revierte la última mejora. `/historial` muestra todas las mejoras.
- `/ayuda` lista el resto de comandos.

## Seguridad de la auto-mejora

- `supervisor.mjs` está protegido: la IA no puede tocarlo.
- Cada mejora es un commit de git; si no pasa la verificación se descarta sola.
- Si una versión nueva se cae al arrancar, el supervisor revierte la mejora automáticamente.
- Los comandos de terminal piden confirmación (desactivable con `/auto si`).
