// Construye el modelo propio «nahual» en Ollama a partir del modelo base, con su personalidad,
// reglas de idioma, método de trabajo y parámetros grabados (Modelfile).
// Uso directo: tsx src/modelo.ts --crear
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cargarConfig, type Config } from './config';
import { ejecutarComando, type ResultadoHerramienta } from './herramientas';
import { PERSONALIDAD } from './indicaciones';
import { DIR_DATOS } from './rutas';

export function textoModelfile(base: string, contexto: number): string {
  return [
    `FROM ${base}`,
    'PARAMETER temperature 0.2',
    'PARAMETER top_p 0.9',
    'PARAMETER repeat_penalty 1.1',
    `PARAMETER num_ctx ${contexto}`,
    `SYSTEM """${PERSONALIDAD.replace(/"""/g, '"')}"""`,
    '',
  ].join('\n');
}

export async function crearModeloNahual(cfg: Config): Promise<ResultadoHerramienta> {
  mkdirSync(DIR_DATOS, { recursive: true });
  const archivo = join(DIR_DATOS, 'Modelfile');
  writeFileSync(archivo, textoModelfile(cfg.modeloBase, cfg.contexto));
  return ejecutarComando(`ollama create ${cfg.modelo} -f "${archivo}"`, DIR_DATOS, {
    limiteMs: 600000,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.argv.includes('--crear')
) {
  const cfg = cargarConfig();
  console.log(`Creando el modelo «${cfg.modelo}» a partir de ${cfg.modeloBase}…`);
  const r = await crearModeloNahual(cfg);
  console.log(
    r.ok ? `✔ Modelo «${cfg.modelo}» listo.` : `✖ No se pudo crear el modelo:\n${r.salida}`,
  );
  process.exit(r.ok ? 0 : 1);
}
