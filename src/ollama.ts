import type { Config } from './config';

export interface Msg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Envía la conversación a Ollama y devuelve la respuesta completa (con streaming opcional). */
export async function chat(
  cfg: Config,
  messages: Msg[],
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: true,
        options: { num_ctx: cfg.numCtx, temperature: cfg.temperature },
      }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(`No se pudo conectar con Ollama en ${cfg.ollamaUrl}. ¿Está abierto? (${(e as Error).message})`);
  }
  if (!res.ok || !res.body) throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const data = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (data.error) throw new Error(`Ollama: ${data.error}`);
      const token = data.message?.content ?? '';
      if (token) {
        out += token;
        onToken?.(token);
      }
    }
  }
  return out;
}

export async function listModels(cfg: Config): Promise<string[]> {
  const res = await fetch(`${cfg.ollamaUrl}/api/tags`);
  if (!res.ok) throw new Error(`Ollama respondió ${res.status}`);
  const data = (await res.json()) as { models: { name: string }[] };
  return data.models.map((m) => m.name);
}
