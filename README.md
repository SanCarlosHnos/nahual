# ⚒ Forja

IA local de terminal (TypeScript + Ollama) que construye software completo y **se mejora a sí misma** de forma segura.

## Instalar

En PowerShell, dentro de esta carpeta:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

Se instala en `%LOCALAPPDATA%\Programs\Forja`, con accesos directos en el menú Inicio y el escritorio, y el comando `forja` en cualquier terminal.
Tus proyectos van a `Documentos\Forja` y los ajustes a `%APPDATA%\Forja\config.json`.
Esta carpeta queda como la «fábrica»: la copia instalada es la que evoluciona.

## Uso

- Escribe una instrucción normal → Forja planifica, escribe el código, lo compila y corrige errores.
- `/mejorar <indicación>` → Forja se mejora a sí misma (ver abajo).
- `/deshacer` revierte la última mejora · `/historial` muestra la evolución · `/ayuda` lista todo.

## Por qué no puede dañarse sola

1. **Taller aislado**: la IA trabaja sobre una copia (git worktree). La versión que usas no se toca.
2. **Núcleo protegido**: el supervisor, el guardián y las pruebas (`nucleo/`) no se pueden modificar; si una mejora lo intenta, se descarta entera.
3. **Pruebas inmutables**: compilación estricta + autopruebas + pruebas reales de la interfaz con un Ollama simulado (que `/mejorar`, `/deshacer` y las tareas sigan funcionando).
4. **Solo se aplica lo verificado**: si no pasa, se borra el taller y Forja queda igual.
5. **Vuelta automática**: si una versión nueva no arranca, el supervisor vuelve a la última que funcionó.
6. **Rescate manual**, aunque todo lo demás falle:

```powershell
forja --deshacer     # revierte la última mejora
forja --rescate      # vuelve a la versión de fábrica
forja --historial    # muestra todas las versiones
```

En las mejoras, cada comando de terminal que quiera ejecutar la IA te pide permiso.
