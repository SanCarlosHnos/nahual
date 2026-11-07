// Herramienta: leer
// Lee archivos o lista directorios
import { z } from 'zod';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { rutaSegura, rutaRelativa, arbolDeArchivos, recortar } from '../herramientas';
import { crearTool } from '../servicios/tool';

const schema = z.object({
  ruta: z.string().min(1, 'La ruta no puede estar vacía'),
});

export const toolLeer = crearTool(
  'leer',
  'Lee el contenido de un archivo o lista los archivos de un directorio',
  schema,
  async (params, ctx) => {
    const absoluta = rutaSegura(ctx.raiz, params.ruta);
    
    if (!existsSync(absoluta)) {
      return { ok: false, resumen: 'No existe', salida: `No existe: ${params.ruta}` };
    }
    
    if (statSync(absoluta).isDirectory()) {
      const arbol = arbolDeArchivos(ctx.raiz, params.ruta);
      return { 
        ok: true, 
        resumen: `${arbol.split('\n').length} elementos`, 
        salida: arbol 
      };
    }
    
    const contenido = readFileSync(absoluta, 'utf8');
    return { 
      ok: true, 
      resumen: `Leí ${contenido.split('\n').length} líneas`, 
      salida: recortar(contenido, 20000) 
    };
  }
);
