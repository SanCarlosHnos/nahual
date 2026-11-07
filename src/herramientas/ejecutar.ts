// Herramienta: ejecutar
// Ejecuta comandos de terminal
import { z } from 'zod';
import { mkdirSync } from 'node:fs';
import { ejecutarComando } from '../herramientas';
import { crearTool } from '../servicios/tool';

const BLOQUEADO_EN_PLANEACION = 'Estás en la fase de planeación: todavía no puedes modificar archivos ni ejecutar comandos. Presenta tu plan con la acción plan.';

function esComandoPeligroso(comando: string): boolean {
  const comandosPeligrosos = [
    /\b(rm|del)\s+(-rf|--force|-r)\b/,
    /\bformat\b/,
    /\bdd\b/,
    /\bmkfs\b/,
    /\b(fdisk|diskpart)\b/,
  ];
  return comandosPeligrosos.some((p) => p.test(comando));
}

const schema = z.object({
  comando: z.string().min(1, 'El comando no puede estar vacío'),
});

export const toolEjecutar = crearTool(
  'ejecutar',
  'Ejecuta un comando de terminal',
  schema,
  async (params, ctx, senal) => {
    if (ctx.soloLectura) {
      return { ok: false, resumen: 'Bloqueado en la planeación', salida: BLOQUEADO_EN_PLANEACION };
    }
    
    if (esComandoPeligroso(params.comando)) {
      return {
        ok: false,
        salida: 'Este comando parece peligroso y requiere aprobación explícita incluso con autoAprobar activado.',
        resumen: 'Comando peligroso bloqueado',
      };
    }
    
    if (!ctx.autoAprobar) {
      const opciones = ctx.permitirSiempre 
        ? ['Sí', 'Sí, y no volver a preguntar en esta sesión', 'No'] 
        : ['Sí', 'No'];
      const eleccion = await ctx.ui.elegir('¿Ejecuto este comando?', opciones, params.comando);
      
      if (eleccion < 0 || opciones[eleccion] === 'No') {
        return {
          ok: false,
          salida: 'El usuario no autorizó este comando. Pregúntale qué prefiere o resuélvelo de otra forma.',
          resumen: 'No autorizado',
        };
      }
      
      if (ctx.permitirSiempre && eleccion === 1) {
        ctx.autoAprobar = true;
      }
    }
    
    mkdirSync(ctx.raiz, { recursive: true });
    return ejecutarComando(params.comando, ctx.raiz, { senal });
  }
);
