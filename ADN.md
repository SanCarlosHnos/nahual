# ADN de Nahual

Nahual es un asistente de programación **con ventana gráfica** (Electron) escrito en TypeScript (Node + tsx) que usa modelos locales de Ollama. Habla español latinoamericano. Hace tres cosas:
1. **Tareas**: construye y modifica software en la carpeta de trabajo del usuario.
2. **Auto-mejora** (`/mejorar` o pedírselo en lenguaje natural): mejora su propio código de forma segura, con un plan que el usuario aprueba, todo dentro de la misma ventana.
3. **Conoce el equipo**: hardware, herramientas de desarrollo y programas instalados del usuario.

## Dos capas
- **La ventana** (carpeta `electron/`): el proceso principal de Electron crea la ventana y lanza el **motor** como proceso hijo. La parte visual (`electron/ui/`) es HTML/CSS/JS e incluye un avatar animado.
- **El motor** (carpeta `src/`): toda la lógica (agente, protocolo, herramientas, Ollama…). No sabe de Electron; se comunica con la ventana por mensajes JSON con prefijo a través de la entrada y salida estándar (ver `src/interfaz/grafica.ts`).

Separar las capas permite que las pruebas corran el motor con una interfaz de texto (`NAHUAL_TEXTO=1`) sin necesidad de ventana.

## Cómo funciona una mejora (no se puede saltar)
1. La ventana detecta la intención de mejora (o el usuario usa `/mejorar`); el motor guarda la instrucción en `NAHUAL_PETICION` y sale con código **43**.
2. `electron/main.mjs` (protegido) recibe el 43 y lanza `nucleo/correr-mejora.mjs` (protegido), que llama al **guardián** (`nucleo/guardian.mjs`, protegido). Todo el progreso se muestra en la misma ventana.
3. El guardián crea un **taller**: copia aislada con `git worktree` en `.taller/<id>`.
4. Lanza `src/mejorador.ts` sobre esa copia, en dos fases: **planeación** (solo lectura; el usuario aprueba el plan en la ventana) y **ejecución** (implementa y se autoverifica).
5. El guardián rechaza la mejora si toca archivos protegidos y verifica la copia con `nucleo/verificar.mjs` (inmutable).
6. Solo si todo pasa: commit `mejora: …` y fast-forward. Si no, el taller se borra y nada cambia.
7. Al terminar, `electron/main.mjs` recarga el motor con la versión nueva, sin cerrar la ventana. Si la versión nueva no arranca, vuelve sola a la anterior.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `supervisor.mjs` | PROTEGIDO. Lanza la app de Electron; si falla al arrancar vuelve a `ultima-buena`; comandos `--rescate`/`--deshacer`/`--historial`. |
| `electron/main.mjs` | PROTEGIDO. Proceso principal de Electron: ventana, lanza el motor, puente motor↔ventana, maneja la mejora (código 43) y la recarga. |
| `electron/preload.mjs` | PROTEGIDO. Puente seguro (contextBridge) entre la ventana y el proceso principal. |
| `electron/ui/` | EDITABLE. La ventana: `index.html`, `styles.css`, `app.js` (chat + avatar animado). Nahual puede mejorarla. |
| `nucleo/guardian.mjs` | PROTEGIDO. Taller aislado, control de archivos protegidos, verificación, aplicación. |
| `nucleo/correr-mejora.mjs` | PROTEGIDO. Ejecuta el guardián y manda su progreso a la ventana como eventos JSON. |
| `nucleo/verificar.mjs` | PROTEGIDO. Pruebas inmutables: tsc, autopruebas, arranques `--check`, sintaxis de la ventana, extremo a extremo con Ollama simulado. |
| `nucleo/proteccion.json` | PROTEGIDO. Lista de rutas que Nahual no puede modificar. |
| `src/principal.ts` | Bucle del motor: comandos `/…`, clasifica la intención y despacha a tarea o mejora. `--check` solo carga y sale. Código 42 = reiniciar, 43 = mejora. |
| `src/interfaz/grafica.ts` | Interfaz que habla con la ventana por JSON (entrada/salida estándar). La usa el motor con `NAHUAL_GRAFICA=1`. |
| `src/interfaz/texto.ts` | Interfaz de texto (pruebas y uso sin ventana). |
| `src/interfaz/tipos.ts` | Contrato `Interfaz` / `Evento` entre el motor y cualquier interfaz. |
| `src/interfaz/formato.ts` | Formato de texto compartido (colores, markdown mínimo, plan). |
| `src/mejorador.ts` | Trabajador de mejoras: fase de plan (solo lectura) + ejecución sobre `NAHUAL_STAGING`. Salida 0 ok, 1 fallo, 3 cancelado/sin cambios. |
| `src/agente.ts` | Clase `Agente`: bucle modelo → acciones → resultados. Controla divagación, idioma, plan, preguntar y recordar. |
| `src/protocolo.ts` | Tipos `Accion` y `analizarAcciones`. Etiquetas en español; tolera que el modelo omita el «>» de apertura. |
| `src/herramientas.ts` | Ejecuta las acciones dentro de una raíz segura. `aplicarEdicion` aplica BUSCAR/REEMPLAZAR. |
| `src/indicaciones.ts` | Identidad, reglas de idioma, método, protocolo, calidad y el ejemplo de entrenamiento. Usa `abrir()`/`cerrar()`. |
| `src/idioma.ts` | Revisor de español latinoamericano (no revisa el código). |
| `src/intencion.ts` | Clasifica cada mensaje: mejora, tarea o charla. |
| `src/equipo.ts` | Inventario del equipo (PowerShell): hardware, herramientas, programas. |
| `src/memoria.ts` | Memoria permanente (`memoria.md`) y registro de experiencias (`experiencias/*.jsonl`). |
| `src/modelo.ts` | Crea el modelo propio «nahual» en Ollama (Modelfile) a partir del modelo base. |
| `src/ollama.ts` | Cliente HTTP de Ollama con streaming. |
| `src/config.ts` | Configuración en `%APPDATA%\Nahual\config.json`. |
| `src/comandos.ts` | Lista `comandos`. Para agregar uno: `{ nombre, argumentos?, descripcion, ejecutar }`. |
| `src/rutas.ts` | `RAIZ`, `DIR_DATOS`, carpeta de trabajo y lista de protegidos. |
| `src/git.ts` | `git(...)` en la carpeta de Nahual. |
| `src/autopruebas.ts` | Autopruebas propias (amplíalas al agregar lógica). |

## Protocolo motor ↔ ventana
El motor escribe en su salida líneas `\u0001NJ:` + JSON: `{t:'evento', e:Evento}`, `{t:'leer', id, indicacion}`, `{t:'elegir', id, pregunta, opciones, detalle}`. La ventana responde por la entrada: `{t:'respuesta', id, valor}` y `{t:'interrumpir'}`.

## Contratos que las pruebas inmutables exigen
- `/ayuda` muestra `/mejorar`, `/deshacer` y `/salir`; la interfaz cierra con código 0 con `/salir`.
- `/mejorar X` escribe `{"instruccion":"X"}` en `NAHUAL_PETICION` y sale con 43.
- Con un modelo que responde con una acción escribir, una tarea crea el archivo en `NAHUAL_TRABAJO`.
- `electron/main.mjs`, `electron/preload.mjs`, `electron/ui/app.js` y `nucleo/correr-mejora.mjs` deben tener sintaxis válida.

## Convenciones
- TypeScript estricto, módulos ES, imports **sin extensión** (`./agente`), salvo `./interfaz/index`.
- Nombres y textos en español latinoamericano. Sin dependencias nuevas (tsx, electron).
- **Regla crítica**: ningún archivo de `src/` contiene literalmente una etiqueta de cierre de acción
  (menor + barra + escribir/editar/ejecutar/terminar). En regex se escapa la barra; en indicaciones se usan `abrir()`/`cerrar()`.
- Para cambiar cómo se ve la ventana, edita `electron/ui/` (HTML/CSS/JS). Lógica nueva → comprobaciones en `src/autopruebas.ts`.
