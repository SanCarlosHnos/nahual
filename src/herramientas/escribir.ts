// Herramienta: escribir
// Crea o sobrescribe archivos
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { rutaSegura, rutaRelativa } from '../herramientas';
import { crearTool } from '../servicios/tool';

const BLOQUEADO_EN_PLANEACION = 'Estás en la fase de planeación: todavía no puedes modificar archivos ni ejecutar comandos. Presenta tu plan con la acción plan.';

function esProtegida(ctx: any, absoluta: string): boolean {
  const rel = rutaRelativa(ctx.raiz, absoluta);
  const esWindows = process.platform === 'win32';
  const normalizar = esWindows ? (s: string) => s.toLowerCase() : (s: string) => s;
  const relNorm = normalizar(rel);
  return ctx.protegidos.some((p: string) => {
    const pNorm = normalizar(p);
    return relNorm === pNorm || relNorm.startsWith(pNorm + '/');
  });
}

function lineasDeDiferencia(signo: '+' | '-', texto: string): any[] {
  return texto.split('\n').map((t) => ({ signo, texto: t }));
}

const schema = z.object({
  ruta: z.string().min(1, 'La ruta no puede estar vacía'),
  contenido: z.string(),
});

export const toolEscribir = crearTool(
  'escribir',
  'Crea o sobrescribe un archivo con el contenido especificado',
  schema,
  async (params, ctx) => {
    if (ctx.soloLectura) {
      return { ok: false, resumen: 'Bloqueado en la planeación', salida: BLOQUEADO_EN_PLANEACION };
    }
    
    const absoluta = rutaSegura(ctx.raiz, params.ruta);
    
    if (esProtegida(ctx, absoluta)) {
      return { 
        ok: false, 
        resumen: 'Archivo protegido', 
        salida: `Archivo protegido, no se puede modificar: ${params.ruta}` 
      };
    }
    
    const existia = existsSync(absoluta);
    mkdirSync(dirname(absoluta), { recursive: true });
    writeFileSync(absoluta, params.contenido);
    ctx.cambiados.add(rutaRelativa(ctx.raiz, absoluta));
    
    const lineas = params.contenido.split('\n').length;
    return {
      ok: true,
      salida: `Escrito ${params.ruta} (${lineas} líneas).`,
      resumen: `${existia ? 'Reescribí' : 'Creé'} ${lineas} líneas`,
      diferencias: lineasDeDiferencia('+', params.contenido.trimEnd()).slice(0, 10),
    };
  }
);
