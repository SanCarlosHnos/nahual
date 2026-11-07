import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_DATOS } from './rutas';

export interface Config {
  /** Modelo de Ollama que usa Nahual (el modelo propio «nahual», creado a partir de modeloBase). */
  modelo: string;
  /** Modelo de Ollama a partir del cual se construye el modelo propio. */
  modeloBase: string;
  urlOllama: string;
  /** Tamaño de contexto en tokens. */
  contexto: number;
  temperatura: number;
  /** Máximo de turnos del agente por petición. */
  maxPasos: number;
  /** Intentos de corrección cuando falla la verificación de una mejora. */
  maxCorrecciones: number;
  /** Ejecutar comandos sin pedir permiso (nunca aplica en mejoras). */
  autoAprobar: boolean;
  /** Carpeta predeterminada para los proyectos. */
  carpetaProyectos: string;
}

export const PREDETERMINADA: Config = {
  modelo: 'nahual',
  modeloBase: 'huihui_ai/qwen2.5-coder-abliterate:14b',
  urlOllama: 'http://127.0.0.1:11434',
  contexto: 16384,
  temperatura: 0.2,
  maxPasos: 30,
  maxCorrecciones: 3,
  autoAprobar: false,
  carpetaProyectos: '',
};

const ARCHIVO = join(DIR_DATOS, 'config.json');

export function cargarConfig(): Config {
  let cfg: Config = { ...PREDETERMINADA };
  if (existsSync(ARCHIVO)) {
    try {
      const datos = JSON.parse(
        readFileSync(ARCHIVO, 'utf8').replace(/^FEFF/, ''),
      ) as Partial<Config>;
      cfg = { ...PREDETERMINADA, ...datos };
    } catch {
      // configuración dañada: se usan los valores predeterminados
    }
  }
  if (process.env.NAHUAL_MODELO) cfg.modelo = process.env.NAHUAL_MODELO;
  if (process.env.NAHUAL_OLLAMA) cfg.urlOllama = process.env.NAHUAL_OLLAMA;
  return cfg;
}

export function guardarConfig(cfg: Config): void {
  mkdirSync(DIR_DATOS, { recursive: true });
  writeFileSync(ARCHIVO, JSON.stringify(cfg, null, 2) + '\n');
}
