#!/usr/bin/env node
// SUPERVISOR — archivo protegido: Nahual NO puede modificarlo.
//  - Lanza la interfaz (src/principal.ts).
//  - Código 42 → reinicia.   Código 43 → el guardián aplica una mejora y reinicia.
//  - Si una versión nueva falla al arrancar, vuelve sola a la última versión que funcionó.
//  - Comandos de emergencia: nahual --rescate | --deshacer | --historial
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as readline from 'node:readline/promises';
import { asegurarRepo, git, mejorar, RAIZ } from './nucleo/guardian.mjs';

const TSX = join(RAIZ, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const DATOS = process.env.NAHUAL_DATOS ?? join(process.env.APPDATA ?? join(homedir(), '.config'), 'Nahual');
const PETICION = join(DATOS, 'peticion.json');
const REGISTRO = join(DATOS, 'nahual.log');
const SANO_TRAS_MS = 15000;

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

process.on('SIGINT', () => {}); // Ctrl+C lo gestiona el proceso hijo.

function lanzarInterfaz() {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [TSX, join(RAIZ, 'src', 'principal.ts')], {
      cwd: RAIZ,
      stdio: 'inherit',
      env: { ...process.env, NAHUAL_CWD: process.env.NAHUAL_CWD ?? process.cwd(), NAHUAL_PETICION: PETICION, NAHUAL_DATOS: DATOS },
    });
    hijo.on('exit', (codigo) => ok(codigo ?? 1));
    hijo.on('error', () => ok(1));
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
    if (await preguntar('¿Volver a la versión de FÁBRICA (la instalada originalmente)? Las mejoras quedan en el historial. (s/n) ')) {
      const r = git(['reset', '--hard', 'fabrica']);
      log(r.ok ? '✔ Nahual restaurado a la versión de fábrica.' : '✖ ' + r.out);
    }
    return;
  }
  console.log('Opciones: nahual | nahual --historial | nahual --deshacer | nahual --rescate');
}

async function bucle() {
  for (;;) {
    const inicio = Date.now();
    const versionLanzada = git(['rev-parse', 'HEAD']).out;
    const codigo = await lanzarInterfaz();
    const sano = codigo === 0 || codigo === 42 || codigo === 43 || Date.now() - inicio > SANO_TRAS_MS;

    if (sano) git(['tag', '-f', 'ultima-buena', versionLanzada]);

    if (codigo === 42) {
      log('\n↻ Reiniciando Nahual…\n');
      continue;
    }
    if (codigo === 43) {
      let instruccion = '';
      try {
        instruccion = JSON.parse(readFileSync(PETICION, 'utf8')).instruccion ?? '';
        rmSync(PETICION, { force: true });
      } catch {}
      if (instruccion) {
        const aplicada = await mejorar(instruccion, log);
        log(aplicada ? '\n↻ Cargando la nueva versión…\n' : '\n↻ Vuelvo a la versión actual…\n');
      }
      continue;
    }
    if (!sano) {
      const buena = git(['rev-parse', 'ultima-buena']).out;
      if (buena && buena !== git(['rev-parse', 'HEAD']).out) {
        log('\n✖ Esta versión falló al arrancar. Vuelvo automáticamente a la última que funcionó…\n');
        git(['reset', '--hard', 'ultima-buena']);
        continue;
      }
      log('\n✖ Nahual se cerró con un error. Si no logra arrancar, ejecuta: nahual --rescate');
    }
    process.exit(codigo);
  }
}

asegurarRepo();
const opcion = process.argv[2];
if (opcion?.startsWith('--')) await emergencia(opcion);
else await bucle();
