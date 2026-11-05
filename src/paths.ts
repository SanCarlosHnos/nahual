import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta raíz de Forja (donde está package.json). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Carpeta desde la que el usuario lanzó Forja. */
export const LAUNCH_DIR = resolve(process.env.FORJA_CWD ?? process.cwd());

/** Carpeta de datos del usuario (config.json, registro). Fuera del código de Forja. */
export const CONFIG_DIR = resolve(
  process.env.FORJA_CONFIG_DIR ?? join(process.env.APPDATA ?? join(homedir(), '.config'), 'Forja'),
);

/** Carpeta donde Forja trabaja en las tareas. */
export function defaultWorkdir(carpetaProyectos: string): string {
  if (process.env.FORJA_WORKDIR) return resolve(process.env.FORJA_WORKDIR);
  if (LAUNCH_DIR !== ROOT) return LAUNCH_DIR;
  return carpetaProyectos ? resolve(carpetaProyectos) : join(homedir(), 'Forja');
}

/** Rutas (relativas a ROOT) que Forja nunca puede modificar al mejorarse. Definidas en el núcleo protegido. */
export const PROTECTED_SELF: string[] = (
  JSON.parse(readFileSync(join(ROOT, 'nucleo', 'proteccion.json'), 'utf8')) as { protegidos: string[] }
).protegidos;
