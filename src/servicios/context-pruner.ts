// Gestiona la poda del contexto de conversación cuando excede el presupuesto de tokens.
// Implementa estrategias de resumen y eliminación selectiva para mantener la conversación
// dentro de los límites del modelo.
import type { Mensaje } from '../ollama';
import type { ConversationManager } from './conversation-manager';

export interface ContextPrunerConfig {
  factorReduccion: number;
  maxResumenCaracteres: number;
}

export const CONFIG_PODADOR_DEFAULT: ContextPrunerConfig = {
  factorReduccion: 0.7,
  maxResumenCaracteres: 500,
};

const RESULTADOS_VIEJOS = '[RESULTADOS ANTERIORES OMITIDOS PARA AHORRAR MEMORIA]';

export class ContextPruner {
  private readonly config: ContextPrunerConfig;

  constructor(config: ContextPrunerConfig = CONFIG_PODADOR_DEFAULT) {
    this.config = config;
  }

  /** Verifica si el contexto necesita ser podado. */
  necesitaPoda(conversation: ConversationManager, presupuesto: number): boolean {
    return conversation.excedePresupuesto(presupuesto);
  }

  /**
   * Podar el contexto usando la estrategia de resumen de resultados.
   * Reemplaza los resultados antiguos con un resumen compacto.
   */
  podarResultados(conversation: ConversationManager, recientes: number): void {
    const mensajes = conversation.mensajesRecientes(recientes);
    for (let i = 0; i < mensajes.length; i++) {
      const msg = mensajes[i];
      if (msg && msg.role === 'user' && msg.content.includes('###')) {
        const resumen = this.resumirResultados(msg.content);
        const idx = conversation.obtenerInicio() + i;
        conversation.modificar(idx, resumen);
      }
    }
  }

  /**
   * Podar el contexto eliminando turnos intermedios.
   * Mantiene los primeros (system + ejemplo) y los últimos N mensajes.
   */
  podarTurnos(conversation: ConversationManager, mantener: number): void {
    conversation.limpiarHasta(mantener);
  }

  /**
   * Estrategia completa de poda: primero resume resultados, luego elimina turnos si es necesario.
   */
  podar(conversation: ConversationManager, presupuesto: number, recientes: number): void {
    if (!this.necesitaPoda(conversation, presupuesto)) return;

    // Intentar primero resumir resultados
    this.podarResultados(conversation, recientes);

    // Si aún excede, eliminar turnos viejos
    if (this.necesitaPoda(conversation, presupuesto)) {
      const mantener = Math.max(
        recientes,
        Math.floor(conversation.longitud() * this.config.factorReduccion),
      );
      this.podarTurnos(conversation, mantener);
    }
  }

  /** Resume el contenido de resultados antiguos. */
  private resumirResultados(contenido: string): string {
    const encabezados = contenido
      .split('\n')
      .filter((l) => l.startsWith('### '))
      .map((l) => (l.length > 120 ? `${l.slice(0, 120)}…` : l));

    if (encabezados.length > 0) {
      const resumen = encabezados.join('\n');
      if (resumen.length > this.config.maxResumenCaracteres) {
        return `${resumen.slice(0, this.config.maxResumenCaracteres)}…\n[cuerpo omitido]`;
      }
      return `RESULTADOS (resumen):\n\n${resumen}\n[cuerpo omitido para ahorrar memoria]`;
    }

    return RESULTADOS_VIEJOS;
  }
}
