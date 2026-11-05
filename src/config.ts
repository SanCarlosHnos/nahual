import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from './paths';

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
  /** Si es true, ejecuta comandos sin pedir confirmación (nunca en mejoras). */
  autoApproveCommands: boolean;
  /** Carpeta por defecto para los proyectos. */
  carpetaProyectos: string;
}

export const DEFAULTS: Config = {
  model: 'huihui_ai/qwen2.5-coder-abliterate:14b',
  ollamaUrl: 'http://127.0.0.1:11434',
  numCtx: 16384,
  temperature: 0.2,
  maxSteps: 30,
  maxFixAttempts: 3,
  autoApproveCommands: false,
  carpetaProyectos: '',
};

const FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig(): Config {
  let cfg: Config = { ...DEFAULTS };
  if (existsSync(FILE)) {
    try {
      cfg = { ...DEFAULTS, ...(JSON.parse(readFileSync(FILE, 'utf8').replace(/^﻿/, '')) as Partial<Config>) };
    } catch {
      // config dañada: se usan los valores por defecto
    }
  }
  if (process.env.FORJA_MODEL) cfg.model = process.env.FORJA_MODEL;
  if (process.env.FORJA_OLLAMA_URL) cfg.ollamaUrl = process.env.FORJA_OLLAMA_URL;
  return cfg;
}

export function saveConfig(cfg: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n');
}
