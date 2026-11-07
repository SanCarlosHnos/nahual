// Tests unitarios para ToolRegistry
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/servicios/tool-registry.js';
import { crearTool } from '../../../src/servicios/tool.js';
import { z } from 'zod';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  const toolEjemplo = crearTool(
    'ejemplo',
    'Herramienta de ejemplo',
    z.object({ texto: z.string() }),
    async (params) => ({
      ok: true,
      resumen: `Procesado: ${params.texto}`,
      salida: `Resultado: ${params.texto}`,
    })
  );

  it('registra herramientas correctamente', () => {
    registry.registrar(toolEjemplo);
    expect(registry.tiene('ejemplo')).toBe(true);
    expect(registry.obtener('ejemplo')).toBe(toolEjemplo);
  });

  it('rechaza herramientas duplicadas', () => {
    registry.registrar(toolEjemplo);
    expect(() => registry.registrar(toolEjemplo)).toThrow('ya está registrada');
  });

  it('lista todas las herramientas', () => {
    registry.registrar(toolEjemplo);
    const herramientas = registry.listar();
    expect(herramientas).toHaveLength(1);
    expect(herramientas[0]).toBe(toolEjemplo);
  });

  it('lista nombres de herramientas', () => {
    registry.registrar(toolEjemplo);
    const nombres = registry.listarNombres();
    expect(nombres).toEqual(['ejemplo']);
  });

  it('valida parámetros correctamente', () => {
    registry.registrar(toolEjemplo);
    const resultado = registry.validar('ejemplo', { texto: 'hola' });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data).toEqual({ texto: 'hola' });
    }
  });

  it('rechaza parámetros inválidos', () => {
    registry.registrar(toolEjemplo);
    const resultado = registry.validar('ejemplo', { texto: 123 });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('Validación fallida');
    }
  });

  it('reporta herramienta no encontrada', () => {
    const resultado = registry.validar('inexistente', {});
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('no encontrada');
    }
  });

  it('desregistra herramientas', () => {
    registry.registrar(toolEjemplo);
    expect(registry.tiene('ejemplo')).toBe(true);
    registry.desregistrar('ejemplo');
    expect(registry.tiene('ejemplo')).toBe(false);
  });

  it('limpia todas las herramientas', () => {
    registry.registrar(toolEjemplo);
    registry.limpiar();
    expect(registry.listarNombres()).toHaveLength(0);
  });
});
