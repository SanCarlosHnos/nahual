// Herramienta: listar
// Lista archivos en un directorio
import { z } from 'zod';
import { arbolDeArchivos } from '../herramientas';
import { crearTool } from '../servicios/tool';

const schema = z.object({
  ruta: z.string().min(1, 'La ruta no puede estar vacía'),
});

export const toolListar = crearTool(
  'listar',
  'Lista los archivos y directorios en una ruta',
  schema,
  async (params, ctx) => {
    const arbol = arbolDeArchivos(ctx.raiz, params.ruta);
    return { 
      ok: true, 
      resumen: `${arbol.split('\n').length} elementos`, 
      salida: arbol 
    };
  }
);
