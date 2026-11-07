// Tests unitarios para tool.ts
import { describe, it, expect } from 'vitest';
import { crearTool, extraerParametros, type Tool } from '../../../src/servicios/tool.js';
import { z } from 'zod';
import type { Accion } from '../../../src/protocolo.js';

describe('tool', () => {
  describe('crearTool', () => {
    it('crea una herramienta válida', () => {
      const schema = z.object({ texto: z.string() });
      const tool = crearTool('test', 'Test tool', schema, async (params) => ({
        ok: true,
        resumen: params.texto,
        salida: params.texto,
      }));

      expect(tool.nombre).toBe('test');
      expect(tool.descripcion).toBe('Test tool');
      expect(tool.schema).toBe(schema);
      expect(typeof tool.ejecutar).toBe('function');
    });
  });

  describe('extraerParametros', () => {
    it('extrae ruta de acción leer', () => {
      const schema = z.object({ ruta: z.string() });
      const tool: Tool<{ ruta: string }> = {
        nombre: 'leer',
        descripcion: 'Leer archivo',
        schema,
        ejecutar: async () => ({ ok: true, resumen: '', salida: '' }),
      };

      const accion: Accion = { tipo: 'leer', ruta: 'test.txt' };
      const params = extraerParametros(tool, accion);

      expect(params).toEqual({ ruta: 'test.txt' });
    });

    it('extrae múltiples campos de acción escribir', () => {
      const schema = z.object({ ruta: z.string(), contenido: z.string() });
      const tool: Tool<{ ruta: string; contenido: string }> = {
        nombre: 'escribir',
        descripcion: 'Escribir archivo',
        schema,
        ejecutar: async () => ({ ok: true, resumen: '', salida: '' }),
      };

      const accion: Accion = { tipo: 'escribir', ruta: 'test.txt', contenido: 'hola' };
      const params = extraerParametros(tool, accion);

      expect(params).toEqual({ ruta: 'test.txt', contenido: 'hola' });
    });

    it('extrae bloques de acción editar', () => {
      const schema = z.object({ ruta: z.string(), bloques: z.array(z.any()) });
      const tool: Tool<{ ruta: string; bloques: any[] }> = {
        nombre: 'editar',
        descripcion: 'Editar archivo',
        schema,
        ejecutar: async () => ({ ok: true, resumen: '', salida: '' }),
      };

      const accion: Accion = {
        tipo: 'editar',
        ruta: 'test.txt',
        bloques: [{ buscar: 'a', reemplazar: 'b' }],
      };
      const params = extraerParametros(tool, accion);

      expect(params).toEqual({
        ruta: 'test.txt',
        bloques: [{ buscar: 'a', reemplazar: 'b' }],
      });
    });

    it('extrae comando de acción ejecutar', () => {
      const schema = z.object({ comando: z.string() });
      const tool: Tool<{ comando: string }> = {
        nombre: 'ejecutar',
        descripcion: 'Ejecutar comando',
        schema,
        ejecutar: async () => ({ ok: true, resumen: '', salida: '' }),
      };

      const accion: Accion = { tipo: 'ejecutar', comando: 'npm test' };
      const params = extraerParametros(tool, accion);

      expect(params).toEqual({ comando: 'npm test' });
    });

    it('extrae patrón de acción buscar', () => {
      const schema = z.object({ patron: z.string(), ruta: z.string() });
      const tool: Tool<{ patron: string; ruta: string }> = {
        nombre: 'buscar',
        descripcion: 'Buscar',
        schema,
        ejecutar: async () => ({ ok: true, resumen: '', salida: '' }),
      };

      const accion: Accion = { tipo: 'buscar', patron: 'test', ruta: '.' };
      const params = extraerParametros(tool, accion);

      expect(params).toEqual({ patron: 'test', ruta: '.' });
    });
  });
});
