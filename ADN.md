# ADN de Nahual

Nahual es un asistente de programación de terminal escrito en TypeScript (Node + tsx) que usa modelos locales de Ollama.
Habla español latinoamericano. Hace tres cosas:
1. **Tareas**: construye y modifica software en la carpeta de trabajo del usuario.
2. **Auto-mejora** (`/mejorar` o pedírselo en lenguaje natural): mejora su propio código de forma segura, con un plan que el usuario aprueba.
3. **Conoce el equipo**: hardware, herramientas de desarrollo y programas instalados del usuario.

## Cómo funciona una mejora (no se puede saltar)
1. La interfaz detecta la intención de mejora (o el usuario usa `/mejorar`), guarda la instrucción en `NAHUAL_PETICION` y sale con código **43**.
2. El **supervisor** (protegido) recibe el 43 y llama al **guardián** (`nucleo/guardian.mjs`, protegido).
3. El guardián crea un **taller**: copia aislada con `git worktree` en `.taller/<id>`.
4. Lanza `src/mejorador.ts`, que trabaja en dos fases: **planeación** (solo lectura; el usuario aprueba el plan) y **ejecución** (implementa y se autoverifica).
5. El guardián rechaza la mejora si toca archivos protegidos, y verifica la copia con `nucleo/verificar.mjs` (inmutable).
6. Solo si todo pasa: commit `mejora: …` y fast-forward a la rama en uso. Si no, el taller se borra y nada cambia.
7. Si la nueva versión se cae al arrancar, el supervisor vuelve a la etiqueta git `ultima-buena`.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `supervisor.mjs` | PROTEGIDO. Arranque, códigos 42/43, vuelta a `ultima-buena`, `--rescate`/`--deshacer`/`--historial`. |
| `nucleo/guardian.mjs` | PROTEGIDO. Taller aislado, control de archivos protegidos, verificación, aplicación. |
| `nucleo/verificar.mjs` | PROTEGIDO. Pruebas inmutables: tsc, autopruebas, arranques `--check`, pruebas reales con Ollama simulado. |
| `nucleo/proteccion.json` | PROTEGIDO. Lista de rutas que Nahual no puede modificar. |
| `src/principal.ts` | Bucle de la interfaz: comandos `/…`, clasifica la intención y despacha a tarea o mejora. `--check` solo carga y sale. |
| `src/mejorador.ts` | Trabajador de mejoras: fase de plan (solo lectura) + ejecución sobre `NAHUAL_STAGING`. Salida 0 ok, 1 fallo, 3 cancelado/sin cambios. |
| `src/agente.ts` | Clase `Agente`: bucle modelo → acciones → resultados. Controla divagación (bucles, exceso de texto), idioma, plan, preguntar y recordar. |
| `src/protocolo.ts` | Tipos `Accion` y `analizarAcciones`: convierte el texto del modelo en acciones. Etiquetas en español (y en inglés como respaldo). |
| `src/herramientas.ts` | Ejecuta las acciones dentro de una raíz segura. `aplicarEdicion` aplica BUSCAR/REEMPLAZAR. Comandos sin bloquear. |
| `src/indicaciones.ts` | Identidad, reglas de idioma, método, protocolo, calidad y el ejemplo de entrenamiento. Usa `abrir()`/`cerrar()`. |
| `src/idioma.ts` | Revisor que detecta inglés, otros alfabetos y español de España en la prosa (no en el código). |
| `src/intencion.ts` | Clasifica cada mensaje: mejora, tarea o charla. |
| `src/equipo.ts` | Inventario del equipo (PowerShell): hardware, herramientas, programas. Se guarda en `%APPDATA%\Nahual\equipo.json`. |
| `src/memoria.ts` | Memoria permanente (`memoria.md`) y registro de experiencias exitosas (`experiencias/*.jsonl`). |
| `src/modelo.ts` | Crea el modelo propio «nahual» en Ollama (Modelfile) a partir del modelo base. |
| `src/ollama.ts` | Cliente HTTP de Ollama con streaming (`conversar`, `listarModelos`). |
| `src/config.ts` | Configuración en `%APPDATA%\Nahual\config.json`. Variables `NAHUAL_MODELO`, `NAHUAL_OLLAMA` la sobrescriben. |
| `src/comandos.ts` | Lista `comandos`. Para agregar uno: `{ nombre, argumentos?, descripcion, ejecutar }`. Devuelve 'salir', 'reiniciar', 'mejorar' o nada. |
| `src/rutas.ts` | `RAIZ`, `DIR_DATOS`, carpeta de trabajo y lista de protegidos. |
| `src/git.ts` | `git(...)` en la carpeta de Nahual. |
| `src/interfaz/` | Interfaz: `tipos.ts` (contrato `Interfaz`/`Evento`), `tui.tsx` (Ink + React), `texto.ts` (respaldo), `formato.ts`, `index.ts`. |
| `src/autopruebas.ts` | Autopruebas propias (amplíalas al agregar lógica). |

## Contratos que las pruebas inmutables exigen
- `/ayuda` muestra `/mejorar`, `/deshacer` y `/salir`, y la interfaz cierra con código 0 al recibir `/salir`.
- `/mejorar X` escribe `{"instruccion":"X"}` en `NAHUAL_PETICION` y sale con 43.
- Con un modelo que responde con una acción escribir, una tarea crea el archivo en `NAHUAL_TRABAJO`.
- La interfaz de texto se activa con la variable `NAHUAL_TEXTO=1` o cuando no hay terminal interactiva.

## Convenciones
- TypeScript estricto, módulos ES, imports **sin extensión** (`./agente`), salvo `./interfaz/index`.
- Nombres y textos en español latinoamericano. Sin dependencias nuevas (solo tsx, ink, react).
- **Regla crítica**: ningún archivo de `src/` contiene literalmente una etiqueta de cierre de acción
  (menor + barra + escribir/editar/ejecutar/terminar). En regex se escapa la barra; en indicaciones se usan `abrir()`/`cerrar()`.
- Lógica nueva → nuevas comprobaciones en `src/autopruebas.ts`.
