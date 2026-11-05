import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta raíz de Forja (donde está package.json). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Carpeta desde la que el usuario lanzó Forja. */
export const LAUNCH_DIR = resolve(process.env.FORJA_CWD ?? process.cwd());

/** Carpeta por defecto para los proyectos que Forja construye. */
export function defaultWorkdir(): string {
  return LAUNCH_DIR === ROOT ? join(ROOT, 'proyectos') : LAUNCH_DIR;
}

/** Rutas (relativas a ROOT) que Forja nunca puede modificar al mejorarse. */
export const PROTECTED_SELF = ['supervisor.mjs', '.git', 'node_modules', 'package-lock.json'];
