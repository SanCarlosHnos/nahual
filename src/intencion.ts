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
  const texto = quitarRazonamiento(respuesta).toUpperCase().trim();
  // Buscar la palabra clave más específica primero, evitando falsos positivos
  // Si el texto contiene "TAREA" y no está negado, es tarea
  // Si el texto contiene "MEJORA" y no está negado, es mejora
  // Si el texto contiene "CHARLA" y no está negado, es charla

  // Contar ocurrencias y verificar que no estén negadas
  const tieneTarea =
    /\bTAREA\b/.test(texto) && !/NO\s+ES\s+TAREA|NO\s+ES\s+UNA\s+TAREA/.test(texto);
  const tieneMejora =
    /\bMEJORA\b/.test(texto) && !/NO\s+ES\s+MEJORA|NO\s+ES\s+UNA\s+MEJORA/.test(texto);
  const tieneCharla =
    /\bCHARLA\b/.test(texto) && !/NO\s+ES\s+CHARLA|NO\s+ES\s+UNA\s+CHARLA/.test(texto);

  // Si hay múltiples intenciones, priorizar la que aparezca primero en el texto
  const posiciones: Array<{ tipo: Intencion; pos: number }> = [];
  if (tieneTarea) {
    const m = texto.match(/\bTAREA\b/);
    if (m && m.index !== undefined) posiciones.push({ tipo: 'tarea', pos: m.index });
  }
  if (tieneMejora) {
    const m = texto.match(/\bMEJORA\b/);
    if (m && m.index !== undefined) posiciones.push({ tipo: 'mejora', pos: m.index });
  }
  if (tieneCharla) {
    const m = texto.match(/\bCHARLA\b/);
    if (m && m.index !== undefined) posiciones.push({ tipo: 'charla', pos: m.index });
  }

  if (posiciones.length === 0) return null;
  posiciones.sort((a, b) => a.pos - b.pos);
  return posiciones[0].tipo;
}

export async function clasificarIntencion(
  cfg: Config,
  mensaje: string,
  senal?: AbortSignal,
): Promise<Intencion> {
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
