#!/usr/bin/env node
// SUPERVISOR — archivo protegido: Forja NO puede modificarlo.
// Lanza src/main.ts. Si sale con código 42 la reinicia (carga la nueva versión).
// Si una versión recién mejorada falla al arrancar, revierte el último commit y reintenta.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const RESTART = 42;
const CRASH_WINDOW_MS = 15000;

if (!existsSync(TSX)) {
  console.error('Faltan dependencias. Ejecuta "npm install" dentro de ' + ROOT);
  process.exit(1);
}

let justRestarted = false;

function start() {
  const startedAt = Date.now();
  const child = spawn(process.execPath, [TSX, join(ROOT, 'src', 'main.ts'), ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, FORJA_CWD: process.env.FORJA_CWD ?? process.cwd() },
  });
  // Ctrl+C lo gestiona el hijo; el supervisor no debe morir por ello.
  process.on('SIGINT', () => {});
  child.on('exit', (code) => {
    const crashedFast = Date.now() - startedAt < CRASH_WINDOW_MS && code !== 0 && code !== RESTART;
    if (code === RESTART) {
      console.log('\n↻ Reiniciando Forja con la nueva versión...\n');
      justRestarted = true;
      start();
      return;
    }
    if (justRestarted && crashedFast) {
      console.error('\n✖ La nueva versión falló al arrancar. Revirtiendo la última mejora...');
      const r = spawnSync('git', ['revert', '--no-edit', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
      console.error(r.status === 0 ? '✔ Mejora revertida.' : 'No se pudo revertir: ' + r.stderr);
      justRestarted = false;
      if (r.status === 0) {
        start();
        return;
      }
    }
    process.exit(code ?? 0);
  });
}

start();
