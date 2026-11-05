import { spawnSync } from 'node:child_process';
import { RAIZ } from './rutas';

export interface ResultadoGit {
  ok: boolean;
  salida: string;
}

/** Ejecuta git en la carpeta de Nahual. */
export function git(...argumentos: string[]): ResultadoGit {
  const r = spawnSync('git', argumentos, { cwd: RAIZ, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}
