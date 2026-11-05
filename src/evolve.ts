import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Agent } from './agent';
import type { Config } from './config';
import { PROTECTED_SELF, ROOT } from './paths';
import { evolveSystemPrompt } from './prompts';
import { runCommand, truncate } from './tools';
import { ui } from './ui';

export interface GitResult {
  ok: boolean;
  out: string;
}

export function git(...args: string[]): GitResult {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

/** Garantiza que Forja vive en un repositorio git con todo confirmado. */
export function ensureRepo(): void {
  if (!existsSync(join(ROOT, '.git'))) {
    git('init');
    ui.info('Repositorio git creado para registrar la evolución de Forja.');
  }
  if (!git('config', 'user.email').out) {
    git('config', 'user.email', 'forja@local');
    git('config', 'user.name', 'Forja');
  }
  if (git('status', '--porcelain').out) {
    git('add', '-A');
    git('commit', '-m', 'estado previo (cambios manuales)');
  }
}

/** Comprobaciones que toda nueva versión debe superar. */
export const VERIFY_STEPS: { name: string; command: string }[] = [
  { name: 'compilación TypeScript', command: 'npx --no-install tsc --noEmit' },
  { name: 'autopruebas', command: 'npx --no-install tsx src/selftest.ts' },
  { name: 'arranque de prueba', command: 'npx --no-install tsx src/main.ts --check' },
];

export function verify(): { ok: boolean; report: string } {
  for (const step of VERIFY_STEPS) {
    ui.info(`  verificando: ${step.name}…`);
    const r = runCommand(step.command, ROOT, 120000);
    if (!r.ok) return { ok: false, report: `Falló "${step.name}" (${step.command}):\n${truncate(r.output, 6000)}` };
  }
  return { ok: true, report: 'Todo correcto.' };
}

export type EvolveOutcome = 'applied' | 'discarded' | 'nochange';

export async function evolve(
  instruction: string,
  cfg: Config,
  confirm: (q: string) => Promise<boolean>,
  signal?: AbortSignal,
): Promise<EvolveOutcome> {
  ensureRepo();
  const base = git('rev-parse', 'HEAD');
  const hasBase = base.ok;

  const rollback = (): void => {
    if (hasBase) git('reset', '--hard', base.out);
    else git('checkout', '--', '.');
    git('clean', '-fd');
  };

  const agent = new Agent(cfg, evolveSystemPrompt(), {
    root: ROOT,
    protectedPaths: PROTECTED_SELF,
    confirm,
    autoApprove: cfg.autoApproveCommands,
    changed: new Set(),
    requireDone: true,
  });

  try {
    let result = await agent.run(
      `Mejora solicitada por el usuario:\n${instruction}\n\nEmpieza explorando los archivos relevantes.`,
      signal,
    );
    if (signal?.aborted) {
      rollback();
      ui.warn('Mejora cancelada; se restauró la versión anterior.');
      return 'discarded';
    }
    if (agent.ctx.changed.size === 0) {
      ui.warn('No se modificó ningún archivo.');
      if (result.summary) ui.answer(result.summary);
      return 'nochange';
    }

    ui.info('\nVerificando la nueva versión…');
    let check = verify();
    for (let attempt = 1; !check.ok && attempt <= cfg.maxFixAttempts; attempt++) {
      ui.warn(`La verificación falló (intento de corrección ${attempt}/${cfg.maxFixAttempts}).`);
      result = await agent.run(
        `La verificación automática FALLÓ. Corrige el problema y vuelve a usar done.\n\n${check.report}`,
        signal,
      );
      if (signal?.aborted) break;
      check = verify();
    }

    if (!check.ok || signal?.aborted) {
      rollback();
      ui.error('No se logró una versión que funcione. Cambios descartados; Forja sigue como estaba.');
      if (!check.ok) console.log(ui.paint('gray', truncate(check.report, 1500)));
      return 'discarded';
    }

    git('add', '-A');
    git('commit', '-m', `mejora: ${instruction.slice(0, 120)}`);
    ui.ok('Mejora aplicada y verificada.');
    if (result.summary) ui.answer(result.summary);
    console.log(ui.paint('gray', git('diff', '--stat', hasBase ? base.out : 'HEAD~0', 'HEAD').out));
    return 'applied';
  } catch (e) {
    rollback();
    ui.error(`Error durante la mejora: ${(e as Error).message}. Se restauró la versión anterior.`);
    return 'discarded';
  }
}
