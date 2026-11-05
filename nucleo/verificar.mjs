// NÚCLEO PROTEGIDO — Forja no puede modificar este archivo.
// Pruebas inmutables que TODA versión nueva de Forja debe superar antes de reemplazar a la actual.
// Uso: node nucleo/verificar.mjs <carpeta-de-la-version>
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const T = (n) => '<' + n;
const C = (n) => '<' + '/' + n + '>';

function ejecutar(args, cwd, timeout = 180000) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() || String(r.error ?? '') };
}

/** Servidor que imita la API de Ollama y responde siempre con el mismo guion. */
async function ollamaFalso(respuesta) {
  const server = createServer((req, res) => {
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
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}`, cerrar: () => server.close() };
}

/** Lanza la interfaz de Forja como lo haría un usuario, con la entrada dada. */
function lanzarForja(dir, entrada, env) {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [TSX, join(dir, 'src', 'main.ts')], {
      cwd: dir,
      env: { ...process.env, ...env, NO_COLOR: '1', FORCE_COLOR: '0' },
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
  const tmp = mkdtempSync(join(tmpdir(), 'forja-verif-'));
  const guion =
    'Creo el archivo.\n' +
    T('write') + ' path="hola.txt">\nforja-ok\n' + C('write') + '\n' +
    T('done') + 'Archivo creado.' + C('done');
  const ollama = await ollamaFalso(guion);
  const env = {
    FORJA_OLLAMA_URL: ollama.url,
    FORJA_MODEL: 'simulado',
    FORJA_CONFIG_DIR: join(tmp, 'config'),
    FORJA_WORKDIR: join(tmp, 'trabajo'),
    FORJA_PETICION: join(tmp, 'peticion.json'),
  };
  const fallos = [];
  try {
    const ayuda = await lanzarForja(dir, '/ayuda\n', env);
    for (const cmd of ['/mejorar', '/deshacer', '/salir']) {
      if (!ayuda.salida.includes(cmd)) fallos.push(`/ayuda ya no muestra ${cmd}`);
    }
    if (ayuda.codigo !== 0) fallos.push(`/ayuda terminó con código ${ayuda.codigo}:\n${ayuda.salida.slice(-1500)}`);

    const mejora = await lanzarForja(dir, '/mejorar aprende algo nuevo\n', env);
    let peticion = null;
    try {
      peticion = JSON.parse(readFileSync(env.FORJA_PETICION, 'utf8'));
    } catch {}
    if (mejora.codigo !== 43 || peticion?.instruccion !== 'aprende algo nuevo') {
      fallos.push(
        `/mejorar debe guardar {"instruccion": ...} en FORJA_PETICION y salir con código 43 (salió con ${mejora.codigo}):\n${mejora.salida.slice(-1500)}`,
      );
    }

    const tarea = await lanzarForja(dir, 'crea el archivo hola.txt\n', env);
    const archivo = join(env.FORJA_WORKDIR, 'hola.txt');
    if (!existsSync(archivo) || readFileSync(archivo, 'utf8').trim() !== 'forja-ok') {
      fallos.push(`una tarea ya no es capaz de escribir archivos:\n${tarea.salida.slice(-1500)}`);
    }
  } finally {
    ollama.cerrar();
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: fallos.length === 0, salida: fallos.join('\n\n') };
}

/** Ejecuta todas las pruebas sobre la versión de Forja que está en `dir`. */
export async function verificar(dir, log = console.log) {
  dir = resolve(dir);
  const pasos = [
    ['compilación TypeScript estricta', () => ejecutar([TSC, '-p', join(dir, 'tsconfig.json')], dir)],
    ['autopruebas (src/selftest.ts)', () => ejecutar([TSX, join(dir, 'src', 'selftest.ts')], dir)],
    ['arranque de la interfaz', () => ejecutar([TSX, join(dir, 'src', 'main.ts'), '--check'], dir, 60000)],
    ['arranque del trabajador de mejoras', () => ejecutar([TSX, join(dir, 'src', 'evolver.ts'), '--check'], dir, 60000)],
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
  mkdirSync(tmpdir(), { recursive: true });
  const r = await verificar(dir);
  console.log(r.informe);
  process.exit(r.ok ? 0 : 1);
}
