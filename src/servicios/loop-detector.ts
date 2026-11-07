// Detecta patrones de bucle en las respuestas del modelo.
// Usa una ventana deslizante de huellas de acciones para identificar cuando el agente
// está repitiendo la misma operación sin progreso.
import type { Accion } from '../protocolo';
import { huellaAcciones } from '../protocolo';

export interface LoopDetectorConfig {
  ventanaHuellas: number;
  repeticionesParaAtasco: number;
}

export const CONFIG_LOOP_DEFAULT: LoopDetectorConfig = {
  ventanaHuellas: 6,
  repeticionesParaAtasco: 3,
};

export class LoopDetector {
  private historialHuellas: string[] = [];
  private readonly config: LoopDetectorConfig;

  constructor(config: LoopDetectorConfig = CONFIG_LOOP_DEFAULT) {
    this.config = config;
  }

  /** Registra las huellas de las acciones del turno actual. */
  registrar(acciones: Accion[]): void {
    const huella = huellaAcciones(acciones);
    if (huella) {
      this.historialHuellas.push(huella);
      if (this.historialHuellas.length > this.config.ventanaHuellas) {
        this.historialHuellas.shift();
      }
    }
  }

  /** Verifica si hay un patrón de bucle en el historial reciente. */
  detectarAtasco(): boolean {
    if (this.historialHuellas.length < this.config.repeticionesParaAtasco) {
      return false;
    }

    const ventana = this.historialHuellas.slice(-this.config.ventanaHuellas);
    const ultima = ventana[ventana.length - 1];
    if (!ultima) return false;

    let repeticiones = 0;
    for (let i = ventana.length - 1; i >= 0; i--) {
      if (ventana[i] === ultima) {
        repeticiones++;
        if (repeticiones >= this.config.repeticionesParaAtasco) {
          return true;
        }
      }
    }

    return false;
  }

  /** Reinicia el historial de huellas. */
  reiniciar(): void {
    this.historialHuellas = [];
  }

  /** Obtiene el historial actual de huellas (para debugging). */
  obtenerHistorial(): string[] {
    return [...this.historialHuellas];
  }

  /** Obtiene la última huella registrada. */
  ultimaHuella(): string | null {
    return this.historialHuellas[this.historialHuellas.length - 1] || null;
  }
}
