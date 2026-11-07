import type { Config } from './config';

/** Mensaje de la conversación (los nombres de campo los impone la API de Ollama). */
export interface Mensaje {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpcionesConversar {
  /** Se llama con cada fragmento generado y el total de fragmentos hasta ahora. */
  alToken?: (fragmento: string, total: number) => void;
  senal?: AbortSignal;
  /** Límite de tokens de la respuesta. */
  maxTokens?: number;
  temperatura?: number;
}

/** Envía la conversación a Ollama y devuelve la respuesta completa. */
export async function conversar(cfg: Config, mensajes: Mensaje[], op: OpcionesConversar = {}): Promise<string> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${cfg.urlOllama}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.modelo,
        messages: mensajes,
        stream: true,
        options: {
          num_ctx: cfg.contexto,
          temperature: op.temperatura ?? cfg.temperatura,
          top_p: 0.9,
          repeat_penalty: 1.1,
          ...(op.maxTokens ? { num_predict: op.maxTokens } : {}),
        },
      }),
      signal: op.senal,
    });
  } catch (e) {
    if (op.senal?.aborted) throw e;
    throw new Error(`No pude conectarme con Ollama en ${cfg.urlOllama}. ¿Está abierto? (${(e as Error).message})`);
  }
  if (!respuesta.ok || !respuesta.body) throw new Error(`Ollama respondió ${respuesta.status}: ${await respuesta.text()}`);

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  let texto = '';
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    pendiente += decodificador.decode(value, { stream: true });
    let salto: number;
    while ((salto = pendiente.indexOf('\n')) >= 0) {
      const linea = pendiente.slice(0, salto).trim();
      pendiente = pendiente.slice(salto + 1);
      if (!linea) continue;
      let datos: { message?: { content?: string }; error?: string };
      try {
        datos = JSON.parse(linea) as { message?: { content?: string }; error?: string };
      } catch {
        // Línea mal formada: continuar con la siguiente en lugar de interrumpir toda la conversación
        continue;
      }
      if (datos.error) throw new Error(`Ollama: ${datos.error}`);
      const fragmento = datos.message?.content ?? '';
      if (fragmento) {
        texto += fragmento;
        op.alToken?.(fragmento, ++total);
      }
    }
  }
  return texto;
}

export async function listarModelos(cfg: Config): Promise<string[]> {
  const respuesta = await fetch(`${cfg.urlOllama}/api/tags`);
  if (!respuesta.ok) throw new Error(`Ollama respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { models: { name: string }[] };
  return datos.models.map((m) => m.name);
}

/** Indica si un modelo está instalado (acepta el sufijo «:latest»). */
export function modeloInstalado(modelos: string[], nombre: string): boolean {
  return modelos.some((m) => m === nombre || m === `${nombre}:latest`);
}
