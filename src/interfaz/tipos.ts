// Contrato entre el motor de Nahual y sus interfaces (pantalla interactiva o texto simple).

export interface PasoPlan {
  texto: string;
  hecho: boolean;
}

export interface LineaDiferencia {
  signo: '+' | '-';
  texto: string;
}

export type Evento =
  | {
      tipo: 'bienvenida';
      titulo: string;
      version: string;
      modelo: string;
      carpeta: string;
      consejos: string[];
    }
  | { tipo: 'usuario'; texto: string }
  | { tipo: 'asistente'; texto: string }
  | { tipo: 'accion'; nombre: string; detalle: string }
  | { tipo: 'resultado'; ok: boolean; resumen: string; diferencias?: LineaDiferencia[] }
  | { tipo: 'plan'; pasos: PasoPlan[]; fijo?: boolean }
  | { tipo: 'pensando'; activo: boolean; etiqueta?: string }
  | { tipo: 'progreso'; tokens: number }
  | { tipo: 'estado'; modelo?: string; carpeta?: string; contexto?: number; modo?: string }
  | { tipo: 'info' | 'exito' | 'aviso' | 'error'; texto: string }
  | { tipo: 'bloque'; titulo: string; lineas: string[] };

export interface SugerenciaComando {
  nombre: string;
  descripcion: string;
}

export interface Interfaz {
  /** Muestra algo en pantalla. */
  emitir(evento: Evento): void;
  /** Pide texto al usuario. Devuelve null si la entrada se cerró. */
  leer(indicacion?: string): Promise<string | null>;
  /** Pide elegir una opción. Devuelve el índice elegido; la última opción equivale a «no/cancelar». */
  elegir(pregunta: string, opciones: string[], detalle?: string): Promise<number>;
  /** Función que se llama cuando el usuario interrumpe (Esc o Ctrl+C). */
  alInterrumpir(funcion: () => void): void;
  cerrar(): void;
}
