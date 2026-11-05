// Memoria permanente de Nahual y registro de experiencias.
// - memoria.md: datos que el usuario pidió recordar y lecciones de mejoras fallidas (el guardián también escribe aquí).
// - experiencias/*.jsonl: conversaciones exitosas, útiles para un ajuste fino futuro del modelo.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Mensaje } from './ollama';
import { DIR_DATOS } from './rutas';

const MEMORIA = join(DIR_DATOS, 'memoria.md');
const EXPERIENCIAS = join(DIR_DATOS, 'experiencias');

export function leerMemoria(maxLineas = 40): string {
  if (!existsSync(MEMORIA)) return '';
  const lineas = readFileSync(MEMORIA, 'utf8').split('\n').filter((l) => l.trim());
  return lineas.slice(-maxLineas).join('\n');
}

export function recordar(dato: string): void {
  const limpio = dato.replace(/\s+/g, ' ').trim();
  if (!limpio) return;
  mkdirSync(DIR_DATOS, { recursive: true });
  appendFileSync(MEMORIA, `- ${limpio} (${new Date().toISOString().slice(0, 10)})\n`);
}

export function guardarExperiencia(modo: string, mensajes: Mensaje[]): void {
  try {
    mkdirSync(EXPERIENCIAS, { recursive: true });
    const fecha = new Date().toISOString();
    appendFileSync(join(EXPERIENCIAS, `${fecha.slice(0, 10)}.jsonl`), JSON.stringify({ fecha, modo, mensajes }) + '\n');
  } catch {
    // registrar experiencias nunca debe interrumpir el trabajo
  }
}
