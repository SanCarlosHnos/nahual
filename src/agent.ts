import type { Config } from './config';
import { chat, type Msg } from './ollama';
import { describeAction, parseActions } from './protocol';
import { executeAction, type ToolContext } from './tools';
import { ui } from './ui';

export interface AgentResult {
  finished: boolean;
  summary: string;
}

const OLD_RESULTS = '[resultados antiguos omitidos para ahorrar contexto]';
const WRITE_BODY_RE = /(<write\s+path=["'][^"']*["']\s*>)[\s\S]*?(<\/write>)/g;

/** Agente que conversa con el modelo y ejecuta sus acciones en bucle. */
export class Agent {
  readonly messages: Msg[];

  constructor(
    private readonly cfg: Config,
    systemPrompt: string,
    readonly ctx: ToolContext,
  ) {
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  async run(userMessage: string, signal?: AbortSignal): Promise<AgentResult> {
    this.messages.push({ role: 'user', content: userMessage });
    let nudges = 0;

    for (let step = 1; step <= this.cfg.maxSteps; step++) {
      if (signal?.aborted) return { finished: false, summary: 'Cancelado por el usuario.' };
      this.prune();
      ui.step(step, this.cfg.maxSteps);

      let reply: string;
      try {
        reply = await chat(this.cfg, this.messages, (t) => ui.stream(t), signal);
      } finally {
        ui.endStream();
      }
      this.messages.push({ role: 'assistant', content: reply });

      const actions = parseActions(reply);
      if (actions.length === 0) {
        if (this.ctx.requireDone && nudges < 2) {
          nudges++;
          this.messages.push({
            role: 'user',
            content: 'No usaste ninguna acción. Continúa trabajando con las etiquetas de acción o, si ya terminaste, responde con la acción done y un resumen.',
          });
          continue;
        }
        return { finished: true, summary: reply.trim() };
      }

      const results: string[] = [];
      let doneSummary: string | null = null;
      let allOk = true;
      for (const action of actions) {
        if (signal?.aborted) return { finished: false, summary: 'Cancelado por el usuario.' };
        if (action.type === 'done') {
          doneSummary = action.summary;
          break;
        }
        const desc = describeAction(action);
        ui.action(desc);
        const r = await executeAction(action, this.ctx);
        ui.result(r.ok, r.output);
        if (!r.ok) allOk = false;
        results.push(`### ${desc} → ${r.ok ? 'OK' : 'ERROR'}\n${r.output}`);
      }

      if (doneSummary !== null && allOk) return { finished: true, summary: doneSummary };

      this.messages.push({
        role: 'user',
        content:
          `RESULTADOS:\n\n${results.join('\n\n')}\n\n` +
          (allOk
            ? 'Continúa. Cuando todo esté terminado y verificado, usa la acción done.'
            : 'Hubo errores: analízalos y corrígelos antes de terminar.'),
      });
    }
    return { finished: false, summary: 'Se alcanzó el máximo de pasos sin terminar.' };
  }

  /** Recorta mensajes antiguos para que la conversación quepa en el contexto del modelo. */
  private prune(): void {
    const budget = this.cfg.numCtx * 3; // ~3 caracteres por token
    const size = (): number => this.messages.reduce((n, m) => n + m.content.length, 0);
    const keepRecent = 4;
    for (let i = 2; i < this.messages.length - keepRecent && size() > budget; i++) {
      const m = this.messages[i]!;
      if (m.role === 'user' && m.content.startsWith('RESULTADOS:')) m.content = OLD_RESULTS;
      else if (m.role === 'assistant') m.content = m.content.replace(WRITE_BODY_RE, '$1\n[contenido ya escrito en disco]\n$2');
    }
  }
}
