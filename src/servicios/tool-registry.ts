// Registro centralizado de herramientas
// Gestiona el registro, validación y ejecución de herramientas
import type { z } from 'zod';
import type { Tool, ResultadoHerramienta } from './tool';
import type { Accion } from '../protocolo';
import type { ContextoHerramientas } from '../herramientas';
import { extraerParametros } from './tool';

export class ToolRegistry {
  private herramientas = new Map<string, Tool>();

  /** Registra una herramienta en el registro */
  registrar<T>(tool: Tool<T>): void {
    if (this.herramientas.has(tool.nombre)) {
      throw new Error(`Herramienta '${tool.nombre}' ya está registrada`);
    }
    this.herramientas.set(tool.nombre, tool as Tool);
  }

  /** Obtiene una herramienta por nombre */
  obtener(nombre: string): Tool | undefined {
    return this.herramientas.get(nombre);
  }

  /** Verifica si una herramienta está registrada */
  tiene(nombre: string): boolean {
    return this.herramientas.has(nombre);
  }

  /** Lista todas las herramientas registradas */
  listar(): Tool[] {
    return Array.from(this.herramientas.values());
  }

  /** Lista los nombres de todas las herramientas */
  listarNombres(): string[] {
    return Array.from(this.herramientas.keys());
  }

  /** Valida los parámetros de una herramienta usando su schema Zod */
  validar<T>(nombre: string, params: unknown): { ok: true; data: T } | { ok: false; error: string } {
    const tool = this.herramientas.get(nombre);
    if (!tool) {
      return { ok: false, error: `Herramienta '${nombre}' no encontrada` };
    }

    const result = tool.schema.safeParse(params);
    if (result.success) {
      return { ok: true, data: result.data as T };
    } else {
      const errores = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { ok: false, error: `Validación fallida: ${errores}` };
    }
  }

  /** Ejecuta una herramienta con validación de parámetros */
  async ejecutar(
    accion: Accion,
    ctx: ContextoHerramientas,
    senal?: AbortSignal
  ): Promise<ResultadoHerramienta> {
    const tool = this.herramientas.get(accion.tipo);
    if (!tool) {
      return {
        ok: false,
        resumen: `Herramienta '${accion.tipo}' no encontrada`,
        salida: `No existe una herramienta registrada con el nombre '${accion.tipo}'`,
      };
    }

    const params = extraerParametros(tool, accion);
    const validacion = this.validar(accion.tipo, params);
    
    if (!validacion.ok) {
      return {
        ok: false,
        resumen: `Parámetros inválidos para ${accion.tipo}`,
        salida: validacion.error,
      };
    }

    try {
      return await tool.ejecutar(validacion.data, ctx, senal);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        resumen: `Error ejecutando ${accion.tipo}`,
        salida: mensaje,
      };
    }
  }

  /** Desregistra una herramienta (útil para testing) */
  desregistrar(nombre: string): boolean {
    return this.herramientas.delete(nombre);
  }

  /** Limpia todas las herramientas registradas */
  limpiar(): void {
    this.herramientas.clear();
  }
}
