// Herramienta: buscar
// Busca patrones en archivos
import { z } from 'zod';
import { rutaSegura, recortar } from '../herramientas';
import { crearTool } from '../servicios/tool';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const IGNORADOS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.venv',
  '__pycache__',
  'target',
  'coverage',
  '.taller',
]);
const BINARIOS =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|exe|dll|woff2?|ttf|mp[34]|wav|lock|sqlite|db)$/i;

function esRegexPeligroso(patron: string): boolean {
  const patronesPeligrosos = [/\([^)]*[+*][^)]*\)[+*]/, /\(\.\*\)\{/, /\([^)]*\|[^)]*\)[+*]/];
  return patronesPeligrosos.some((p) => p.test(patron));
}

function recorrer(
  carpeta: string,
  visitar: (absoluta: string, esCarpeta: boolean, nivel: number) => boolean | void,
  nivel = 0,
): void {
  let nombres: string[];
  try {
    nombres = require('node:fs').readdirSync(carpeta).sort();
  } catch {
    return;
  }
  for (const nombre of nombres) {
    if (IGNORADOS.has(nombre)) continue;
    const absoluta = join(carpeta, nombre);
    let esCarpeta = false;
    try {
      esCarpeta = statSync(absoluta).isDirectory();
    } catch {
      continue;
    }
    if (visitar(absoluta, esCarpeta, nivel) === false) return;
    if (esCarpeta) recorrer(absoluta, visitar, nivel + 1);
  }
}

function buscarEnArchivos(
  raiz: string,
  inicio: string,
  patron: string,
): { texto: string; total: number } {
  if (esRegexPeligroso(patron)) {
    return {
      texto: 'Patrón de búsqueda demasiado complejo o peligroso. Usa una búsqueda más simple.',
      total: 0,
    };
  }

  let expresion: RegExp;
  try {
    expresion = new RegExp(patron, 'i');
  } catch {
    expresion = new RegExp(patron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const hallazgos: string[] = [];
  recorrer(rutaSegura(raiz, inicio), (absoluta, esCarpeta) => {
    if (esCarpeta || BINARIOS.test(absoluta) || hallazgos.length >= 60) return;
    if (statSync(absoluta).size > 1_000_000) return;
    readFileSync(absoluta, 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        if (hallazgos.length < 60 && expresion.test(linea)) {
          const rutaRelativa = require('node:path').relative(raiz, absoluta).split(sep).join('/');
          hallazgos.push(`${rutaRelativa}:${i + 1}: ${linea.trim().slice(0, 200)}`);
        }
      });
  });

  return {
    texto: hallazgos.length ? hallazgos.join('\n') : 'Sin coincidencias.',
    total: hallazgos.length,
  };
}

const schema = z.object({
  patron: z.string().min(1, 'El patrón no puede estar vacío'),
  ruta: z.string().default('.'),
});

export const toolBuscar = crearTool(
  'buscar',
  'Busca un patrón de texto en archivos',
  schema,
  async (params, ctx) => {
    const r = buscarEnArchivos(ctx.raiz, params.ruta, params.patron);
    return {
      ok: true,
      resumen: `${r.total} coincidencia${r.total === 1 ? '' : 's'}`,
      salida: r.texto,
    };
  },
);
