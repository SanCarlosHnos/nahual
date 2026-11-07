// Herramienta: editar
// Edita archivos con bloques BUSCAR/REEMPLAZAR
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { rutaSegura, rutaRelativa, aplicarEdicion } from '../herramientas';
import { crearTool } from '../servicios/tool';

const BLOQUEADO_EN_PLANEACION = 'Estás en la fase de planeación: todavía no puedes modificar archivos ni ejecutar comandos. Presenta tu plan con la acción plan.';
const MAX_DIFERENCIAS = 24;

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
  bloques: z.array(z.object({
    buscar: z.string(),
    reemplazar: z.string(),
  })).min(1, 'Debe haber al menos un bloque de edición'),
});

export const toolEditar = crearTool(
  'editar',
  'Edita un archivo reemplazando bloques de texto',
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
    
    if (!existsSync(absoluta)) {
      return { 
        ok: false, 
        resumen: 'No existe', 
        salida: `No existe: ${params.ruta}. Usa escribir para crearlo.` 
      };
    }
    
    let contenido = readFileSync(absoluta, 'utf8');
    const fallidos: number[] = [];
    
    params.bloques.forEach((b, i) => {
      const nuevo = aplicarEdicion(contenido, b.buscar, b.reemplazar);
      if (nuevo === null) fallidos.push(i + 1);
      else contenido = nuevo;
    });
    
    if (fallidos.length) {
      return {
        ok: false,
        salida: `Los bloques ${fallidos.join(', ')} no coinciden con el contenido actual de ${params.ruta}. Vuelve a leer el archivo y copia las líneas exactas. No se aplicó ningún cambio.`,
        resumen: 'El texto a reemplazar no coincide',
      };
    }
    
    writeFileSync(absoluta, contenido);
    ctx.cambiados.add(rutaRelativa(ctx.raiz, absoluta));
    
    const diferencias = params.bloques.flatMap((b) => [
      ...lineasDeDiferencia('-', b.buscar), 
      ...lineasDeDiferencia('+', b.reemplazar)
    ]);
    const agregadas = diferencias.filter((d) => d.signo === '+').length;
    const quitadas = diferencias.length - agregadas;
    
    return {
      ok: true,
      salida: `Editado ${params.ruta} (${params.bloques.length} bloque(s)).`,
      resumen: `${agregadas} línea${agregadas === 1 ? '' : 's'} agregada${agregadas === 1 ? '' : 's'}, ${quitadas} quitada${quitadas === 1 ? '' : 's'}`,
      diferencias: diferencias.slice(0, MAX_DIFERENCIAS),
    };
  }
);
