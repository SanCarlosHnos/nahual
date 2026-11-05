// NÚCLEO PROTEGIDO — Forja no puede modificar este archivo.
// El guardián aplica las mejoras de forma segura:
//   1. Crea un "taller": una copia aislada (git worktree) de la versión actual.
//   2. El trabajador de IA modifica SOLO esa copia; la versión en uso no se toca.
//   3. El guardián comprueba que no se tocaron archivos protegidos y verifica la copia por su cuenta.
//   4. Solo si todo pasa, la copia reemplaza a la versión en uso (commit + fast-forward).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificar } from './verificar.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const PROTEGIDOS = JSON.parse(readFileSync(join(ROOT, 'nucleo', 'proteccion.json'), 'utf8')).protegidos;

export function git(args, cwd = ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const existeRef = (ref) => git(['rev-parse', '--verify', '--quiet', ref]).ok;

/** Deja el repositorio listo: git iniciado, todo confirmado y etiquetas de seguridad creadas. */
export function asegurarRepo() {
  if (!existsSync(join(ROOT, '.git'))) git(['init', '-q']);
  if (!git(['config', 'user.email']).out) {
    git(['config', 'user.email', 'forja@local']);
    git(['config', 'user.name', 'Forja']);
  }
  if (git(['status', '--porcelain']).out) {
    git(['add', '-A']);
    git(['commit', '-q', '-m', existeRef('HEAD') ? 'cambios manuales' : 'génesis']);
  }
  if (!existeRef('refs/tags/fabrica')) git(['tag', 'fabrica']);
  if (!existeRef('refs/tags/ultima-buena')) git(['tag', 'ultima-buena']);
  git(['worktree', 'prune']);
}

const esProtegido = (archivo) => PROTEGIDOS.some((p) => archivo === p || archivo.startsWith(p + '/'));

function lanzarTrabajador(taller, instruccion) {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [TSX, join(ROOT, 'src', 'evolver.ts')], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, FORJA_STAGING: taller, FORJA_INSTRUCCION: instruccion },
    });
    hijo.on('exit', (codigo) => ok(codigo ?? 1));
    hijo.on('error', () => ok(1));
  });
}

/** Ejecuta una mejora completa. Devuelve true si se aplicó. */
export async function mejorar(instruccion, log = console.log) {
  asegurarRepo();
  const base = git(['rev-parse', 'HEAD']).out;
  const id = Date.now().toString(36);
  const rama = `taller/${id}`;
  const taller = join(ROOT, '.taller', id);
  mkdirSync(dirname(taller), { recursive: true });

  const creado = git(['worktree', 'add', '-q', '-b', rama, taller, base]);
  if (!creado.ok) {
    log('✖ No se pudo preparar el taller: ' + creado.out);
    return false;
  }

  try {
    log(`\n🔧 Mejora: «${instruccion}»`);
    log('   La IA trabajará en una copia aislada; la versión que usas no se toca.\n');
    const codigo = await lanzarTrabajador(taller, instruccion);

    // La versión en uso nunca debe cambiar durante una mejora.
    if (git(['status', '--porcelain']).out) {
      log('⚠ Se detectaron cambios en la versión en uso durante la mejora; se han deshecho.');
      git(['reset', '-q', '--hard', 'HEAD']);
      git(['clean', '-q', '-fd']);
    }

    if (codigo === 3) {
      log('ℹ La IA no hizo cambios.');
      return false;
    }
    if (codigo !== 0) {
      log('✖ La IA no consiguió una versión válida. Mejora descartada; Forja sigue igual.');
      return false;
    }

    git(['add', '-A'], taller);
    const cambiados = git(['diff', '--cached', '--name-only', base], taller).out.split('\n').filter(Boolean);
    if (cambiados.length === 0) {
      log('ℹ No hay cambios que aplicar.');
      return false;
    }
    const prohibidos = cambiados.filter(esProtegido);
    if (prohibidos.length) {
      log(`✖ La mejora intentó modificar archivos protegidos (${prohibidos.join(', ')}). Descartada.`);
      return false;
    }

    log('\n🛡  El guardián verifica la nueva versión por su cuenta…');
    const v = await verificar(taller, log);
    if (!v.ok) {
      log('✖ La nueva versión no pasó la verificación del guardián. Descartada.\n' + v.informe.slice(0, 2000));
      return false;
    }

    const commit = git(['commit', '-q', '-m', `mejora: ${instruccion.slice(0, 120)}`], taller);
    if (!commit.ok) {
      log('✖ No se pudo guardar la mejora: ' + commit.out);
      return false;
    }
    const fusion = git(['merge', '-q', '--ff-only', rama]);
    if (!fusion.ok) {
      log('✖ No se pudo aplicar la mejora: ' + fusion.out);
      return false;
    }
    log('\n✔ Mejora verificada y aplicada:');
    log(git(['diff', '--stat', base, 'HEAD']).out);
    return true;
  } finally {
    git(['worktree', 'remove', '--force', taller]);
    git(['branch', '-q', '-D', rama]);
    git(['worktree', 'prune']);
  }
}
