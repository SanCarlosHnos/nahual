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
  const lineas = readFileSync(MEMORIA, 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  return lineas.slice(-maxLineas).join('\n');
}

export function recordar(dato: string): void {
  const limpio = dato.replace(/\s+/g, ' ').trim();
  if (!limpio) return;
  mkdirSync(DIR_DATOS, { recursive: true });
  // Verificar si el dato ya existe en las últimas entradas para evitar duplicados
  if (existsSync(MEMORIA)) {
    const contenido = readFileSync(MEMORIA, 'utf8');
    const lineas = contenido.split('\n').filter((l) => l.trim());
    // Buscar en las últimas 20 entradas si ya existe un dato similar
    const recientes = lineas.slice(-20);
    const yaExiste = recientes.some((linea) => {
      // Extraer el dato de la línea (formato: "- dato (fecha)")
      const match = linea.match(/^-\s+(.+?)\s+\(\d{4}-\d{2}-\d{2}\)$/);
      if (match) {
        const datoExistente = match[1];
        // Comparar ignorando mayúsculas/minúsculas y espacios
        return datoExistente.toLowerCase().replace(/\s+/g, ' ').trim() === limpio.toLowerCase();
      }
      return false;
    });
    if (yaExiste) return;
  }
  appendFileSync(MEMORIA, `- ${limpio} (${new Date().toISOString().slice(0, 10)})\n`);
}

export function guardarExperiencia(modo: string, mensajes: Mensaje[]): void {
  try {
    mkdirSync(EXPERIENCIAS, { recursive: true });
    const fecha = new Date().toISOString();
    appendFileSync(
      join(EXPERIENCIAS, `${fecha.slice(0, 10)}.jsonl`),
      JSON.stringify({ fecha, modo, mensajes }) + '\n',
    );
  } catch {
    // registrar experiencias nunca debe interrumpir el trabajo
  }
}
