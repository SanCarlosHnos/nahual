// Valida las respuestas del modelo antes de procesarlas.
// Detecta respuestas vacías, demasiado cortas, o que no contienen acciones válidas.
import type { Accion } from '../protocolo';

export interface ValidationResult {
  valida: boolean;
  razon?: string;
  sugerencia?: string;
}

export class ResponseValidator {
  private readonly minLength: number;
  private readonly requireActions: boolean;

  constructor(options: { minLength?: number; requireActions?: boolean } = {}) {
    this.minLength = options.minLength ?? 10;
    this.requireActions = options.requireActions ?? false;
  }

  /** Valida que la respuesta no esté vacía o sea demasiado corta. */
  validarTexto(texto: string): ValidationResult {
    if (!texto || texto.trim().length === 0) {
      return {
        valida: false,
        razon: 'Respuesta vacía',
        sugerencia: 'Reintentar con temperatura más alta',
      };
    }

    if (texto.trim().length < this.minLength) {
      return {
        valida: false,
        razon: `Respuesta demasiado corta (${texto.trim().length} caracteres)`,
        sugerencia: 'Reintentar o verificar el prompt del sistema',
      };
    }

    return { valida: true };
  }

  /** Valida que la respuesta contenga al menos una acción. */
  validarAcciones(acciones: Accion[]): ValidationResult {
    if (this.requireActions && acciones.length === 0) {
      return {
        valida: false,
        razon: 'No se encontraron acciones en la respuesta',
        sugerencia: 'Verificar que el modelo esté usando el protocolo XML',
      };
    }

    return { valida: true };
  }

  /** Valida que las acciones no tengan errores de sintaxis críticos. */
  validarSintaxis(acciones: Accion[]): ValidationResult {
    for (const accion of acciones) {
      // Validar que escribir/editar tengan contenido
      if (accion.tipo === 'escribir' && !accion.contenido) {
        return {
          valida: false,
          razon: `Acción escribir sin contenido`,
          sugerencia: 'Verificar formato de la etiqueta escribir',
        };
      }

      if (accion.tipo === 'editar' && (!accion.bloques || accion.bloques.length === 0)) {
        return {
          valida: false,
          razon: `Acción editar sin bloques de cambio`,
          sugerencia: 'Verificar formato de la etiqueta editar',
        };
      }

      // Validar que las acciones con ruta no estén vacías
      if (
        (accion.tipo === 'leer' ||
          accion.tipo === 'listar' ||
          accion.tipo === 'escribir' ||
          accion.tipo === 'editar') &&
        !accion.ruta
      ) {
        return {
          valida: false,
          razon: `Acción ${accion.tipo} sin ruta`,
          sugerencia: 'Verificar atributo ruta en la etiqueta',
        };
      }
    }

    return { valida: true };
  }

  /** Validación completa: texto + acciones + sintaxis. */
  validarCompleto(texto: string, acciones: Accion[]): ValidationResult {
    const textoResult = this.validarTexto(texto);
    if (!textoResult.valida) return textoResult;

    const accionesResult = this.validarAcciones(acciones);
    if (!accionesResult.valida) return accionesResult;

    const sintaxisResult = this.validarSintaxis(acciones);
    if (!sintaxisResult.valida) return sintaxisResult;

    return { valida: true };
  }
}
