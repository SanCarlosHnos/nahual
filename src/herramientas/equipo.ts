// Herramienta: equipo
// Busca información en el inventario del equipo
import { z } from 'zod';
import { buscarEnEquipo } from '../equipo';
import { crearTool } from '../servicios/tool';

const schema = z.object({
  buscar: z.string().min(1, 'El término de búsqueda no puede estar vacío'),
});

export const toolEquipo = crearTool(
  'equipo',
  'Busca información en el inventario del equipo',
  schema,
  async (params, ctx) => {
    const inventario = ctx.equipo();

    if (!inventario) {
      return {
        ok: false,
        resumen: 'Sin inventario',
        salida: 'Todavía no tengo el inventario del equipo.',
      };
    }

    const r = buscarEnEquipo(inventario, params.buscar);
    return {
      ok: true,
      resumen: `${r.total} resultado${r.total === 1 ? '' : 's'}`,
      salida: r.texto,
    };
  },
);
