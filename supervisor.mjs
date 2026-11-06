#!/usr/bin/env node
// SUPERVISOR — archivo protegido: Nahual NO puede modificarlo.
//  - Lanza la aplicación de ventana (Electron).
//  - La auto-mejora y la recarga del motor ocurren dentro de la ventana (ver electron/main.mjs).
//  - Si la aplicación falla nada más arrancar, vuelve sola a la última versión que funcionó.
//  - Comandos de emergencia (terminal): nahual --rescate | --deshacer | --historial
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as readline from 'node:readline/promises';
import { asegurarRepo, git, RAIZ } from './nucleo/guardian.mjs';

const TSX = join(RAIZ, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const DATOS = process.env.NAHUAL_DATOS ?? join(process.env.APPDATA ?? join(homedir(), '.config'), 'Nahual');
const PETICION = join(DATOS, 'peticion.json');
const REGISTRO = join(DATOS, 'nahual.log');
const SANO_TRAS_MS = 20000;

function log(msg) {
  console.log(msg);
  try {
    mkdirSync(DATOS, { recursive: true });
    appendFileSync(REGISTRO, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

if (!existsSync(TSX)) {
  console.error('Faltan dependencias. Ejecuta "npm install" en ' + RAIZ);
  process.exit(1);
}

process.on('SIGINT', () => {});

async function rutaElectron() {
  try {
    return (await import('electron')).default;
  } catch {
    return null;
  }
}

function lanzarApp(electron) {
  return new Promise((ok) => {
    import('node:child_process').then(({ spawn }) => {
      const hijo = spawn(electron, ['.'], {
        cwd: RAIZ,
        stdio: 'inherit',
        env: {
          ...process.env,
          NAHUAL_NODE: process.execPath,
          NAHUAL_CWD: process.env.NAHUAL_CWD ?? process.cwd(),
          NAHUAL_PETICION: PETICION,
          NAHUAL_DATOS: DATOS,
        },
      });
      hijo.on('exit', (codigo) => ok(codigo ?? 1));
      hijo.on('error', () => ok(1));
    });
  });
}

async function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(texto)).trim().toLowerCase();
  rl.close();
  return r === 's' || r === 'si' || r === 'sí';
}

async function emergencia(opcion) {
  if (opcion === '--historial') {
    console.log(git(['log', '--pretty=format:%h  %ad  %s', '--date=short', '-n', '40']).out);
    return;
  }
  if (opcion === '--deshacer') {
    const ultimo = git(['log', '-1', '--pretty=%s']).out;
    if (!ultimo.startsWith('mejora:')) return console.log(`El último cambio no es una mejora («${ultimo}»).`);
    if (await preguntar(`¿Revertir «${ultimo}»? (s/n) `)) {
      const r = git(['revert', '--no-edit', 'HEAD']);
      log(r.ok ? '✔ Mejora revertida.' : '✖ ' + r.out);
    }
    return;
  }
  if (opcion === '--rescate') {
    console.log('Versiones recientes:\n' + git(['log', '--pretty=format:  %h  %s', '-n', '10']).out + '\n');
    if (await preguntar('¿Volver a la versión de FÁBRICA (la instalada originalmente)? (s/n) ')) {
      const r = git(['reset', '--hard', 'fabrica']);
      log(r.ok ? '✔ Nahual restaurado a la versión de fábrica.' : '✖ ' + r.out);
    }
    return;
  }
  console.log('Opciones: nahual | nahual --historial | nahual --deshacer | nahual --rescate');
}

async function bucle() {
  const electron = await rutaElectron();
  if (!electron) {
    log('✖ No encontré Electron. Ejecuta "npm install" en ' + RAIZ);
    process.exit(1);
  }
  for (;;) {
    const inicio = Date.now();
    const versionLanzada = git(['rev-parse', 'HEAD']).out;
    const codigo = await lanzarApp(electron);
    const sano = codigo === 0 || Date.now() - inicio > SANO_TRAS_MS;
    if (sano) git(['tag', '-f', 'ultima-buena', versionLanzada]);

    if (codigo === 0) process.exit(0);

    if (!sano) {
      const buena = git(['rev-parse', 'ultima-buena']).out;
      if (buena && buena !== git(['rev-parse', 'HEAD']).out) {
        log('\n✖ Esta versión falló al arrancar. Vuelvo a la última que funcionó…\n');
        git(['reset', '--hard', 'ultima-buena']);
        continue;
      }
    }
    log('\n✖ Nahual se cerró con un error (código ' + codigo + '). Si no abre, ejecuta: nahual --rescate');
    process.exit(codigo);
  }
}

asegurarRepo();
const opcion = process.argv[2];
if (opcion?.startsWith('--')) await emergencia(opcion);
else await bucle();
