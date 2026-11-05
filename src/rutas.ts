import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta raíz de Nahual (donde está package.json). */
export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Carpeta desde la que el usuario abrió Nahual. */
export const DIR_LANZAMIENTO = resolve(process.env.NAHUAL_CWD ?? process.cwd());

/** Carpeta de datos del usuario: configuración, memoria, inventario del equipo, experiencias. */
export const DIR_DATOS = resolve(
  process.env.NAHUAL_DATOS ?? join(process.env.APPDATA ?? join(homedir(), '.config'), 'Nahual'),
);

/** Carpeta donde Nahual trabaja en las tareas del usuario. */
export function carpetaTrabajoInicial(carpetaProyectos: string): string {
  if (process.env.NAHUAL_TRABAJO) return resolve(process.env.NAHUAL_TRABAJO);
  const esSistema = /\\windows\\system32$/i.test(DIR_LANZAMIENTO);
  if (DIR_LANZAMIENTO !== RAIZ && !esSistema) return DIR_LANZAMIENTO;
  return carpetaProyectos ? resolve(carpetaProyectos) : join(homedir(), 'Nahual');
}

/** Rutas (relativas a RAIZ) que Nahual nunca puede modificar al mejorarse. Las define el núcleo protegido. */
export const PROTEGIDOS: string[] = (
  JSON.parse(readFileSync(join(RAIZ, 'nucleo', 'proteccion.json'), 'utf8')) as { protegidos: string[] }
).protegidos;

export const VERSION: string = (JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { version: string }).version;
