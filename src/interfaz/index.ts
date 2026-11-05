import { crearInterfazTexto } from './texto';
import type { Interfaz, SugerenciaComando } from './tipos';

/** Interfaz interactiva si hay una terminal real; si no (pruebas, tuberías), texto simple. */
export async function crearInterfaz(sugerencias: SugerenciaComando[]): Promise<Interfaz> {
  if (process.stdin.isTTY && process.stdout.isTTY && !process.env.NAHUAL_TEXTO) {
    const { crearInterfazInteractiva } = await import('./tui');
    return crearInterfazInteractiva(sugerencias);
  }
  return crearInterfazTexto();
}
