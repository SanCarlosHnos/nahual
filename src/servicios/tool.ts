// Interfaz base para herramientas del agente
// Todas las herramientas deben implementar esta interfaz para ser registradas en el ToolRegistry
import { z } from 'zod';
import type { Accion } from '../protocolo';
import type { ContextoHerramientas } from '../herramientas';
import type { LineaDiferencia } from '../interfaz/tipos';

export interface ResultadoHerramienta {
  ok: boolean;
  resumen: string;
  salida: string;
  diferencias?: LineaDiferencia[];
}

export interface Tool<TParams = unknown> {
  /** Nombre único de la herramienta (en español) */
  nombre: string;

  /** Descripción de lo que hace la herramienta */
  descripcion: string;

  /** Schema de Zod para validar parámetros */
  schema: z.ZodType<TParams>;

  /** Ejecuta la herramienta con los parámetros validados */
  ejecutar(
    params: TParams,
    ctx: ContextoHerramientas,
    senal?: AbortSignal,
  ): Promise<ResultadoHerramienta>;
}

/** Helper para crear herramientas con validación de tipos */
export function crearTool<TParams>(
  nombre: string,
  descripcion: string,
  schema: z.ZodType<TParams>,
  ejecutar: Tool<TParams>['ejecutar'],
): Tool<TParams> {
  return { nombre, descripcion, schema, ejecutar };
}

/** Convierte una Accion del protocolo en los parámetros de una herramienta */
export function extraerParametros<TParams>(tool: Tool<TParams>, accion: Accion): TParams {
  // Mapear campos de Accion a parámetros según el tipo de herramienta
  const params: Record<string, unknown> = {};

  if ('ruta' in accion) params.ruta = accion.ruta;
  if ('contenido' in accion) params.contenido = accion.contenido;
  if ('bloques' in accion) params.bloques = accion.bloques;
  if ('comando' in accion) params.comando = accion.comando;
  if ('patron' in accion) params.patron = accion.patron;
  if ('dato' in accion) params.dato = accion.dato;
  if ('buscar' in accion) params.buscar = accion.buscar;

  return params as TParams;
}
