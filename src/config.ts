import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths';

export interface Config {
  /** Modelo de Ollama principal. */
  model: string;
  ollamaUrl: string;
  /** Tamaño de contexto en tokens que se pide a Ollama. */
  numCtx: number;
  temperature: number;
  /** Máximo de turnos del agente por instrucción. */
  maxSteps: number;
  /** Intentos de corrección cuando la verificación de una mejora falla. */
  maxFixAttempts: number;
  /** Si es true, ejecuta comandos sin pedir confirmación. */
  autoApproveCommands: boolean;
}

export const DEFAULTS: Config = {
  model: 'huihui_ai/qwen2.5-coder-abliterate:14b',
  ollamaUrl: 'http://127.0.0.1:11434',
  numCtx: 16384,
  temperature: 0.2,
  maxSteps: 30,
  maxFixAttempts: 3,
  autoApproveCommands: false,
};

const FILE = join(ROOT, 'config.json');

export function loadConfig(): Config {
  if (!existsSync(FILE)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Config>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(cfg: Config): void {
  writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n');
}
