import { mkdirSync } from 'node:fs';
import { Agent } from './agent';
import { findCommand, type AppState } from './commands';
import { loadConfig } from './config';
import { LineInput } from './input';
import { listModels } from './ollama';
import { defaultWorkdir } from './paths';
import { taskSystemPrompt } from './prompts';
import { ui } from './ui';

const RESTART_CODE = 42;
const EVOLVE_CODE = 43;

async function main(): Promise<void> {
  const cfg = loadConfig();

  // Modo de comprobación usado por la verificación de mejoras: carga todo y sale.
  if (process.argv.includes('--check')) {
    taskSystemPrompt(defaultWorkdir(cfg.carpetaProyectos));
    console.log('check ok');
    return;
  }

  const state: AppState = { cfg, workdir: defaultWorkdir(cfg.carpetaProyectos), agent: null };
  mkdirSync(state.workdir, { recursive: true });

  let controller: AbortController | null = null;
  const rl = new LineInput(() => {
    if (controller) {
      controller.abort();
      ui.warn('Cancelando…');
    } else {
      rl.close();
      process.exit(0);
    }
  });

  const confirm = async (q: string): Promise<boolean> => {
    const a = ((await rl.ask(ui.paint('yellow', `? ${q} (s/n) `))) ?? '').trim().toLowerCase();
    return a === 's' || a === 'si' || a === 'sí' || a === 'y';
  };

  ui.banner(cfg.model, state.workdir);
  try {
    const models = await listModels(cfg);
    if (!models.includes(cfg.model)) ui.warn(`El modelo ${cfg.model} no está instalado. Usa /modelos y /modelo <nombre>.`);
  } catch {
    ui.warn(`No se pudo contactar con Ollama en ${cfg.ollamaUrl}. Ábrelo antes de dar instrucciones.`);
  }

  for (;;) {
    const input = await rl.ask(ui.paint(['bold', 'yellow'], 'forja › '));
    if (input === null) break;
    const line = input.trim();
    if (!line) continue;

    controller = new AbortController();
    try {
      if (line.startsWith('/')) {
        const [name = '', ...rest] = line.slice(1).split(' ');
        const command = findCommand(name.toLowerCase());
        if (!command) {
          ui.warn(`Comando desconocido: /${name}. Escribe /ayuda.`);
          continue;
        }
        const outcome = await command.run(rest.join(' ').trim(), { state, confirm, signal: controller.signal });
        if (outcome === 'exit') break;
        if (outcome === 'restart' || outcome === 'evolve') {
          rl.close();
          process.exit(outcome === 'restart' ? RESTART_CODE : EVOLVE_CODE);
        }
        continue;
      }

      if (!state.agent) {
        state.agent = new Agent(cfg, taskSystemPrompt(state.workdir), {
          root: state.workdir,
          protectedPaths: ['.git'],
          confirm,
          autoApprove: cfg.autoApproveCommands,
          changed: new Set(),
          requireDone: false,
        });
      }
      state.agent.ctx.autoApprove = cfg.autoApproveCommands;
      const result = await state.agent.run(line, controller.signal);
      if (result.finished) ui.answer(result.summary);
      else ui.warn(result.summary);
    } catch (e) {
      if (controller.signal.aborted) ui.warn('Cancelado.');
      else ui.error((e as Error).message);
    } finally {
      controller = null;
    }
  }
  rl.close();
}

main().catch((e) => {
  ui.error((e as Error).stack ?? String(e));
  process.exit(1);
});
