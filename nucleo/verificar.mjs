// NÚCLEO PROTEGIDO — Nahual no puede modificar este archivo.
// Pruebas inmutables que TODA versión nueva debe superar antes de reemplazar a la actual.
// Uso: node nucleo/verificar.mjs <carpeta-de-la-version>
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSX = join(RAIZ, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const TSC = join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
const T = (n) => '<' + n;
const C = (n) => '<' + '/' + n + '>';

function ejecutar(args, cwd, limite = 180000) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: limite,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', NAHUAL_TEXTO: '1' },
  });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() || String(r.error ?? '') };
}

/** Servidor que imita la API de Ollama y responde siempre con el mismo guion. */
async function ollamaSimulado(respuesta) {
  const servidor = createServer((req, res) => {
    if (req.url === '/api/tags') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ models: [{ name: 'simulado' }] }));
      return;
    }
    if (req.url === '/api/chat') {
      req.resume();
      req.on('end', () => {
        res.setHeader('content-type', 'application/x-ndjson');
        for (const trozo of respuesta.match(/[\s\S]{1,25}/g) ?? []) {
          res.write(JSON.stringify({ message: { role: 'assistant', content: trozo }, done: false }) + '\n');
        }
        res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n');
      });
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => servidor.close() };
}

/** Lanza la interfaz como lo haría un usuario, con la entrada dada. */
function lanzar(dir, archivo, entrada, env) {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [TSX, join(dir, 'src', archivo)], {
      cwd: dir,
      env: { ...process.env, ...env, NO_COLOR: '1', FORCE_COLOR: '0', NAHUAL_TEXTO: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let salida = '';
    hijo.stdout.on('data', (d) => (salida += d));
    hijo.stderr.on('data', (d) => (salida += d));
    const reloj = setTimeout(() => hijo.kill(), 90000);
    hijo.on('exit', (codigo) => {
      clearTimeout(reloj);
      ok({ codigo, salida });
    });
    hijo.stdin.end(entrada);
  });
}

async function pruebasDeExtremoAExtremo(dir) {
  const tmp = mkdtempSync(join(tmpdir(), 'nahual-verif-'));
  const guion = 'Creo el archivo.\n' + T('escribir') + ' ruta="hola.txt">\nnahual-ok\n' + C('escribir') + '\n' + T('terminar') + 'Listo.' + C('terminar');
  const ollama = await ollamaSimulado(guion);
  const env = {
    NAHUAL_OLLAMA: ollama.url,
    NAHUAL_MODELO: 'simulado',
    NAHUAL_DATOS: join(tmp, 'datos'),
    NAHUAL_TRABAJO: join(tmp, 'trabajo'),
    NAHUAL_PETICION: join(tmp, 'peticion.json'),
  };
  const fallos = [];
  try {
    const ayuda = await lanzar(dir, 'principal.ts', '/ayuda\n/salir\n', env);
    for (const cmd of ['/mejorar', '/deshacer', '/salir']) {
      if (!ayuda.salida.includes(cmd)) fallos.push(`/ayuda ya no muestra ${cmd}`);
    }
    if (ayuda.codigo !== 0) fallos.push(`la interfaz no cerró bien con /salir (código ${ayuda.codigo}):\n${ayuda.salida.slice(-1500)}`);

    const mejora = await lanzar(dir, 'principal.ts', '/mejorar aprende algo nuevo\n', env);
    let peticion = null;
    try {
      peticion = JSON.parse(readFileSync(env.NAHUAL_PETICION, 'utf8'));
    } catch {}
    if (mejora.codigo !== 43 || peticion?.instruccion !== 'aprende algo nuevo') {
      fallos.push(`/mejorar debe guardar la instrucción en NAHUAL_PETICION y salir con código 43 (salió con ${mejora.codigo}):\n${mejora.salida.slice(-1500)}`);
    }

    const tarea = await lanzar(dir, 'principal.ts', 'crea el archivo hola.txt\n/salir\n', env);
    const archivo = join(env.NAHUAL_TRABAJO, 'hola.txt');
    if (!existsSync(archivo) || readFileSync(archivo, 'utf8').trim() !== 'nahual-ok') {
      fallos.push(`una tarea ya no es capaz de escribir archivos:\n${tarea.salida.slice(-1500)}`);
    }
  } finally {
    ollama.cerrar();
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: fallos.length === 0, salida: fallos.join('\n\n') };
}

function sintaxisVentana(dir) {
  const archivos = [
    join(dir, 'electron', 'main.mjs'),
    join(dir, 'electron', 'preload.mjs'),
    join(dir, 'electron', 'ui', 'app.js'),
    join(dir, 'nucleo', 'correr-mejora.mjs'),
  ];
  for (const archivo of archivos) {
    if (!existsSync(archivo)) return { ok: false, salida: `Falta un archivo de la ventana: ${archivo}` };
    const r = ejecutar(['--check', archivo], dir, 30000);
    if (!r.ok) return { ok: false, salida: `Error de sintaxis en ${archivo}:\n${r.salida}` };
  }
  if (!existsSync(join(dir, 'electron', 'ui', 'index.html'))) return { ok: false, salida: 'Falta electron/ui/index.html' };
  return { ok: true, salida: '' };
}

export async function verificar(dir, log = console.log) {
  dir = resolve(dir);
  const pasos = [
    ['compilación TypeScript estricta', () => ejecutar([TSC, '-p', join(dir, 'tsconfig.json')], dir)],
    ['autopruebas (src/autopruebas.ts)', () => ejecutar([TSX, join(dir, 'src', 'autopruebas.ts')], dir)],
    ['arranque de la interfaz', () => ejecutar([TSX, join(dir, 'src', 'principal.ts'), '--check'], dir, 60000)],
    ['arranque del mejorador', () => ejecutar([TSX, join(dir, 'src', 'mejorador.ts'), '--check'], dir, 60000)],
    ['sintaxis de la ventana (Electron)', () => sintaxisVentana(dir)],
    ['pruebas de extremo a extremo (Ollama simulado)', () => pruebasDeExtremoAExtremo(dir)],
  ];
  for (const [nombre, paso] of pasos) {
    log(`  · ${nombre}…`);
    const r = await paso();
    if (!r.ok) return { ok: false, informe: `Falló: ${nombre}\n${r.salida.slice(-6000)}` };
  }
  return { ok: true, informe: 'Todas las verificaciones pasaron.' };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Uso: node nucleo/verificar.mjs <carpeta>');
    process.exit(2);
  }
  const r = await verificar(dir);
  console.log(r.informe);
  process.exit(r.ok ? 0 : 1);
}
