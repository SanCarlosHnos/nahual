// Detecta si el usuario le pide a Nahual que se mejore a sí mismo (como cuando le pides algo a un programador).
import type { Config } from './config';
import { INDICACIONES_CLASIFICADOR } from './indicaciones';
import { conversar } from './ollama';
import { quitarRazonamiento } from './protocolo';

export type Intencion = 'mejora' | 'tarea' | 'charla';

/** Señales claras de que el usuario habla de Nahual mismo; se usan si el modelo no responde. */
const SENALES_DE_MEJORA =
  /\b(nahual|mej[oó]rate|actual[ií]zate|modif[ií]cate|agr[eé]gate|a[ñn][aá]dete|ap[ré]ndete|aprende a|tu (propi[oa]|interfaz|c[oó]digo|memoria|forma de)|tus (respuestas|comandos|capacidades)|que (puedas|sepas|tengas)\b)/i;

export function interpretarClasificacion(respuesta: string): Intencion | null {
  const texto = quitarRazonamiento(respuesta).toUpperCase();
  if (texto.includes('MEJORA')) return 'mejora';
  if (texto.includes('CHARLA')) return 'charla';
  if (texto.includes('TAREA')) return 'tarea';
  return null;
}

export async function clasificarIntencion(cfg: Config, mensaje: string, senal?: AbortSignal): Promise<Intencion> {
  try {
    const respuesta = await conversar(
      cfg,
      [
        { role: 'system', content: INDICACIONES_CLASIFICADOR },
        { role: 'user', content: mensaje },
      ],
      { senal, maxTokens: 8, temperatura: 0 },
    );
    const intencion = interpretarClasificacion(respuesta);
    if (intencion) return intencion;
  } catch (e) {
    if (senal?.aborted) throw e;
  }
  return SENALES_DE_MEJORA.test(mensaje) ? 'mejora' : 'tarea';
}
