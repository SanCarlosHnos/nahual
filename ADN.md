# ADN de Forja

Forja es una IA de terminal escrita en TypeScript (Node + tsx) que usa modelos locales de Ollama.
Hace dos cosas:
1. **Tareas**: construye y modifica software en la carpeta de trabajo del usuario.
2. **Auto-mejora** (`/mejorar`): modifica su propio código, se verifica y se reinicia.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `supervisor.mjs` | PROTEGIDO. Lanza `src/main.ts`; si sale con código 42 la reinicia; si una versión recién mejorada falla al arrancar, hace `git revert HEAD`. |
| `src/main.ts` | Bucle de terminal (readline): lee instrucciones, despacha comandos `/…` o se las pasa al agente. `--check` solo carga y sale. |
| `src/commands.ts` | Lista `commands` de comandos con barra. Para añadir uno: agrega un objeto `{ name, args?, description, run }`. `run` devuelve `'exit'`, `'restart'` o nada. |
| `src/agent.ts` | Clase `Agent`: bucle modelo → acciones → resultados, con recorte del contexto (`prune`). |
| `src/protocol.ts` | Tipos `Action` y `parseActions`: convierte el texto del modelo en acciones. |
| `src/tools.ts` | Ejecuta acciones (leer, listar, buscar, escribir, editar, ejecutar) dentro de una raíz segura. `applyEdit` aplica SEARCH/REPLACE. |
| `src/prompts.ts` | Prompts de sistema para tareas (`taskSystemPrompt`) y auto-mejora (`evolveSystemPrompt`). |
| `src/evolve.ts` | Ciclo de auto-mejora: commit base → agente → verificación (`VERIFY_STEPS`) → corrección → commit o rollback. |
| `src/ollama.ts` | Cliente HTTP de Ollama con streaming (`chat`, `listModels`). |
| `src/config.ts` | Configuración (`config.json`, ignorado por git) con valores por defecto. |
| `src/ui.ts` | Salida coloreada en terminal (`node:util` styleText). |
| `src/paths.ts` | `ROOT`, carpeta de trabajo por defecto y rutas protegidas. |
| `src/selftest.ts` | Autopruebas que debe superar toda nueva versión. |

## Convenciones
- TypeScript estricto, módulos ES, imports **sin extensión** (`./agent`).
- Sin dependencias en tiempo de ejecución salvo `tsx`; usa la biblioteca estándar de Node.
- Textos para el usuario en español.
- **Regla crítica**: ningún archivo de `src/` contiene literalmente una etiqueta de cierre de acción
  (barra + write/edit/run/done). En regex se escribe `<\/write>`; en prompts se usan `open()`/`close()`.
- Nueva lógica → nuevas comprobaciones en `src/selftest.ts`.

## Verificación de una mejora
1. `tsc --noEmit`
2. `tsx src/selftest.ts`
3. `tsx src/main.ts --check`

Si falla, el agente recibe el error y tiene `maxFixAttempts` intentos; si no, se hace `git reset --hard` al commit base.
