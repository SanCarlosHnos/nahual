import { spawnSync } from 'node:child_process';
import { ROOT } from './paths';

export interface GitResult {
  ok: boolean;
  out: string;
}

/** Ejecuta git en la carpeta de Forja. */
export function git(...args: string[]): GitResult {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}
