// Trabajador de mejoras. Lo lanza el guardián (nucleo/guardian.mjs) con:
//   FORJA_STAGING     → carpeta del taller (copia aislada de Forja) que se puede modificar
//   FORJA_INSTRUCCION → la mejora pedida por el usuario
// Solo edita la copia del taller. Códigos de salida: 0 = verificado, 1 = fallo, 3 = sin cambios.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as readline from 'node:readline/promises';
import { Agent } from './agent';
import { loadConfig } from './config';
import { PROTECTED_SELF, ROOT } from './paths';
import { evolveSystemPrompt } from './prompts';
import { truncate } from './tools';
import { ui } from './ui';

function verify(dir: string): { ok: boolean; report: string } {
  ui.info('\nVerificando la copia del taller…');
  const r = spawnSync(process.execPath, [join(ROOT, 'nucleo', 'verificar.mjs'), dir], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const report = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  return { ok: r.status === 0, report: truncate(report, 6000) };
}

async function main(): Promise<number> {
  if (process.argv.includes('--check')) {
    evolveSystemPrompt(ROOT);
    console.log('check ok');
    return 0;
  }

  const staging = process.env.FORJA_STAGING;
  const instruction = process.env.FORJA_INSTRUCCION;
  if (!staging || !instruction || !existsSync(staging)) {
    ui.error('El trabajador de mejoras solo lo puede lanzar el guardián.');
    return 1;
  }

  const cfg = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = async (q: string): Promise<boolean> => {
    const a = (await rl.question(ui.paint('yellow', `? ${q} (s/n) `))).trim().toLowerCase();
    return a === 's' || a === 'si' || a === 'sí';
  };

  const agent = new Agent(cfg, evolveSystemPrompt(staging), {
    root: resolve(staging),
    protectedPaths: PROTECTED_SELF,
    confirm,
    autoApprove: false, // en mejoras, cada comando requiere tu permiso
    changed: new Set(),
    requireDone: true,
  });

  try {
    let result = await agent.run(`Mejora solicitada por el usuario:\n${instruction}\n\nEmpieza explorando los archivos relevantes.`);
    if (agent.ctx.changed.size === 0) {
      ui.warn('No se modificó ningún archivo.');
      if (result.summary) ui.answer(result.summary);
      return 3;
    }

    let check = verify(staging);
    for (let attempt = 1; !check.ok && attempt <= cfg.maxFixAttempts; attempt++) {
      ui.warn(`La verificación falló (intento de corrección ${attempt}/${cfg.maxFixAttempts}).`);
      console.log(ui.paint('gray', check.report.slice(-1500)));
      result = await agent.run(`La verificación automática FALLÓ. Corrige el problema y vuelve a usar done.\n\n${check.report}`);
      check = verify(staging);
    }
    if (!check.ok) {
      ui.error('No se logró una versión que pase la verificación.');
      return 1;
    }
    ui.ok('La copia del taller pasó la verificación.');
    if (result.summary) ui.answer(result.summary);
    return 0;
  } finally {
    rl.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    ui.error((e as Error).message);
    process.exit(1);
  });
