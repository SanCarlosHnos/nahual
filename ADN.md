# ADN de Forja

Forja es una IA de terminal escrita en TypeScript (Node + tsx) que usa modelos locales de Ollama.
Hace dos cosas:
1. **Tareas**: construye y modifica software en la carpeta de trabajo del usuario.
2. **Auto-mejora** (`/mejorar`): mejora su propio código de forma segura.

## Cómo funciona una mejora (no se puede saltar)
1. `/mejorar <texto>` guarda `{"instruccion": texto}` en el archivo `FORJA_PETICION` y la interfaz sale con código **43**.
2. El **supervisor** (protegido) recibe el 43 y llama al **guardián** (`nucleo/guardian.mjs`, protegido).
3. El guardián crea un **taller**: copia aislada con `git worktree` en `.taller/<id>`.
4. Lanza `src/evolver.ts` (el trabajador de IA de la versión EN USO) para que edite SOLO la copia del taller.
5. El guardián rechaza la mejora si toca archivos protegidos, y verifica la copia con `nucleo/verificar.mjs` (inmutable).
6. Solo si todo pasa: commit `mejora: …` y fast-forward a la rama en uso. Si no, el taller se borra y nada cambia.
7. Si la nueva versión se cae al arrancar, el supervisor vuelve a la etiqueta git `ultima-buena`.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `supervisor.mjs` | PROTEGIDO. Bucle de arranque, códigos 42/43, vuelta a `ultima-buena`, `--rescate`/`--deshacer`/`--historial`. |
| `nucleo/guardian.mjs` | PROTEGIDO. Taller aislado, control de archivos protegidos, verificación, aplicación. |
| `nucleo/verificar.mjs` | PROTEGIDO. Pruebas inmutables: tsc, selftest, arranques `--check`, pruebas reales con Ollama simulado. |
| `nucleo/proteccion.json` | PROTEGIDO. Lista de rutas que la IA no puede modificar. |
| `src/main.ts` | Bucle de terminal: comandos `/…` o tareas para el agente. `--check` solo carga y sale. Código 42 = reiniciar, 43 = mejora. |
| `src/input.ts` | `LineInput`: lector de líneas con cola (no pierde entradas mientras Forja está ocupada). |
| `src/commands.ts` | Lista `commands`. Para añadir uno: agrega `{ name, args?, description, run }`. `run` devuelve `'exit'`, `'restart'`, `'evolve'` o nada. |
| `src/evolver.ts` | Trabajador de mejoras: ejecuta el agente sobre `FORJA_STAGING` y se autoverifica. Salida 0 = ok, 1 = fallo, 3 = sin cambios. |
| `src/agent.ts` | Clase `Agent`: bucle modelo → acciones → resultados, con recorte del contexto (`prune`). |
| `src/protocol.ts` | Tipos `Action` y `parseActions`: convierte el texto del modelo en acciones. |
| `src/tools.ts` | Ejecuta acciones dentro de una raíz segura. `applyEdit` aplica SEARCH/REPLACE. |
| `src/prompts.ts` | Prompts de sistema para tareas y para mejoras. |
| `src/ollama.ts` | Cliente HTTP de Ollama con streaming (`chat`, `listModels`). |
| `src/config.ts` | Configuración en `%APPDATA%\Forja\config.json`. Variables `FORJA_MODEL`, `FORJA_OLLAMA_URL` la sobrescriben. |
| `src/paths.ts` | `ROOT`, `CONFIG_DIR`, carpeta de trabajo (`FORJA_WORKDIR`) y lista protegida. |
| `src/git.ts` | `git(...)` en la carpeta de Forja. |
| `src/ui.ts` | Salida coloreada en terminal. |
| `src/selftest.ts` | Autopruebas propias (las puedes ampliar). |

## Contratos que las pruebas inmutables exigen
- `/ayuda` lista `/mejorar`, `/deshacer` y `/salir`, y Forja sale con código 0 al cerrarse la entrada.
- `/mejorar X` escribe `{"instruccion":"X"}` en `FORJA_PETICION` y sale con 43.
- Con un modelo que responde con una acción write, una tarea crea el archivo en `FORJA_WORKDIR`.

## Convenciones
- TypeScript estricto, módulos ES, imports **sin extensión** (`./agent`). Sin dependencias nuevas.
- Textos para el usuario en español.
- **Regla crítica**: ningún archivo de `src/` contiene literalmente una etiqueta de cierre de acción
  (barra + write/edit/run/done). En regex se escribe `<\/write>`; en prompts se usan `open()`/`close()`.
- Nueva lógica → nuevas comprobaciones en `src/selftest.ts`.
