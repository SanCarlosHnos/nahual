// Gestiona el historial de mensajes de la conversación.
// Encapsula la lógica de agregar, quitar y consultar mensajes, preservando el system prompt
// y el ejemplo de trabajo inicial.
import type { Mensaje } from '../ollama';

export class ConversationManager {
  private mensajes: Mensaje[] = [];
  private readonly inicio: number;

  constructor(systemPrompt: string, ejemplo: Mensaje[]) {
    this.mensajes = [{ role: 'system', content: systemPrompt }, ...ejemplo];
    this.inicio = this.mensajes.length;
  }

  /** Agrega un mensaje al final del historial. */
  agregar(mensaje: Mensaje): void {
    this.mensajes.push(mensaje);
  }

  /** Obtiene todo el historial de mensajes (incluyendo system prompt y ejemplo). */
  obtenerHistorial(): Mensaje[] {
    return this.mensajes;
  }

  /** Calcula el tamaño total del historial en caracteres (aproximación de tokens). */
  tamano(): number {
    return this.mensajes.reduce((n, m) => n + m.content.length, 0);
  }

  /** Índice donde comienzan los mensajes de la conversación real (después de system + ejemplo). */
  obtenerInicio(): number {
    return this.inicio;
  }

  /** Número total de mensajes en el historial. */
  longitud(): number {
    return this.mensajes.length;
  }

  /** Obtiene un mensaje por índice. */
  obtener(indice: number): Mensaje | undefined {
    return this.mensajes[indice];
  }

  /** Modifica el contenido de un mensaje en el historial. */
  modificar(indice: number, contenido: string): void {
    if (this.mensajes[indice]) {
      this.mensajes[indice].content = contenido;
    }
  }

  /** Elimina mensajes desde el índice inicio hasta dejar solo los últimos `mantener` mensajes. */
  limpiarHasta(mantener: number): void {
    if (mantener < 0) mantener = 0;
    // Calcular cuántos mensajes debemos eliminar para dejar solo `mantener` en total
    const eliminar = this.mensajes.length - mantener;
    if (eliminar > 0) {
      // Solo eliminar mensajes después del índice inicio (preservar system + ejemplo)
      const desdeInicio = Math.min(eliminar, this.mensajes.length - this.inicio);
      if (desdeInicio > 0) {
        this.mensajes.splice(this.inicio, desdeInicio);
      }
    }
  }

  /** Elimina un mensaje en un índice específico. */
  eliminarEn(indice: number): void {
    if (indice >= this.inicio && indice < this.mensajes.length) {
      this.mensajes.splice(indice, 1);
    }
  }

  /** Obtiene los últimos N mensajes del historial. */
  ultimos(n: number): Mensaje[] {
    return this.mensajes.slice(-n);
  }

  /** Obtiene mensajes desde el índice inicio hasta el final, excluyendo los últimos `excluirUltimos`. */
  mensajesRecientes(excluirUltimos: number = 0): Mensaje[] {
    const fin = excluirUltimos > 0 ? -excluirUltimos : undefined;
    return this.mensajes.slice(this.inicio, fin);
  }

  /** Verifica si el historial excede un presupuesto dado en caracteres. */
  excedePresupuesto(presupuesto: number): boolean {
    return this.tamano() > presupuesto;
  }
}
