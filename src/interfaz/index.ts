import { crearInterfazGrafica } from './grafica';
import { crearInterfazTexto } from './texto';
import type { Interfaz, SugerenciaComando } from './tipos';

/**
 * Elige la interfaz:
 * - NAHUAL_GRAFICA=1 → puente con la ventana de Electron.
 * - en otro caso → texto simple (pruebas automatizadas y uso sin ventana).
 * El parámetro de sugerencias se mantiene por compatibilidad; la ventana trae las suyas.
 */
export async function crearInterfaz(_sugerencias: SugerenciaComando[]): Promise<Interfaz> {
  if (process.env.NAHUAL_GRAFICA === '1') return crearInterfazGrafica();
  return crearInterfazTexto();
}
