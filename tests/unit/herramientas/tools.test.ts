// Tests unitarios para herramientas individuales
import { describe, it, expect } from 'vitest';
import { toolLeer } from '../../../src/herramientas/leer.js';
import { toolListar } from '../../../src/herramientas/listar.js';
import { toolEscribir } from '../../../src/herramientas/escribir.js';
import { toolEditar } from '../../../src/herramientas/editar.js';
import { toolBuscar } from '../../../src/herramientas/buscar.js';
import { toolEjecutar } from '../../../src/herramientas/ejecutar.js';
import { toolEquipo } from '../../../src/herramientas/equipo.js';
import { crearRegistryEstandar } from '../../../src/herramientas/index.js';

describe('Herramientas como plugins', () => {
  describe('toolLeer', () => {
    it('tiene nombre y descripción', () => {
      expect(toolLeer.nombre).toBe('leer');
      expect(toolLeer.descripcion).toBeTruthy();
    });

    it('valida parámetros con Zod', () => {
      const resultado = toolLeer.schema.safeParse({ ruta: 'test.txt' });
      expect(resultado.success).toBe(true);
    });

    it('rechaza ruta vacía', () => {
      const resultado = toolLeer.schema.safeParse({ ruta: '' });
      expect(resultado.success).toBe(false);
    });
  });

  describe('toolListar', () => {
    it('tiene nombre y descripción', () => {
      expect(toolListar.nombre).toBe('listar');
      expect(toolListar.descripcion).toBeTruthy();
    });
  });

  describe('toolEscribir', () => {
    it('valida parámetros con Zod', () => {
      const resultado = toolEscribir.schema.safeParse({ 
        ruta: 'test.txt', 
        contenido: 'hola' 
      });
      expect(resultado.success).toBe(true);
    });

    it('rechaza sin contenido', () => {
      const resultado = toolEscribir.schema.safeParse({ 
        ruta: 'test.txt'
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe('toolEditar', () => {
    it('valida parámetros con Zod', () => {
      const resultado = toolEditar.schema.safeParse({ 
        ruta: 'test.txt',
        bloques: [{ buscar: 'a', reemplazar: 'b' }]
      });
      expect(resultado.success).toBe(true);
    });

    it('rechaza sin bloques', () => {
      const resultado = toolEditar.schema.safeParse({ 
        ruta: 'test.txt',
        bloques: []
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe('toolBuscar', () => {
    it('valida parámetros con Zod', () => {
      const resultado = toolBuscar.schema.safeParse({ 
        patron: 'test',
        ruta: '.'
      });
      expect(resultado.success).toBe(true);
    });

    it('rechaza patrón vacío', () => {
      const resultado = toolBuscar.schema.safeParse({ 
        patron: ''
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe('toolEjecutar', () => {
    it('valida parámetros con Zod', () => {
      const resultado = toolEjecutar.schema.safeParse({ 
        comando: 'echo hola'
      });
      expect(resultado.success).toBe(true);
    });

    it('rechaza comando vacío', () => {
      const resultado = toolEjecutar.schema.safeParse({ 
        comando: ''
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe('toolEquipo', () => {
    it('valida parámetros con Zod', () => {
      const resultado = toolEquipo.schema.safeParse({ 
        buscar: 'python'
      });
      expect(resultado.success).toBe(true);
    });
  });

  describe('crearRegistryEstandar', () => {
    it('registra todas las herramientas estándar', () => {
      const registry = crearRegistryEstandar();
      const nombres = registry.listarNombres();
      
      expect(nombres).toContain('leer');
      expect(nombres).toContain('listar');
      expect(nombres).toContain('buscar');
      expect(nombres).toContain('escribir');
      expect(nombres).toContain('editar');
      expect(nombres).toContain('ejecutar');
      expect(nombres).toContain('equipo');
    });

    it('todas las herramientas tienen schema Zod', () => {
      const registry = crearRegistryEstandar();
      const herramientas = registry.listar();
      
      herramientas.forEach((tool) => {
        expect(tool.schema).toBeDefined();
        expect(tool.nombre).toBeTruthy();
        expect(tool.descripcion).toBeTruthy();
      });
    });
  });
});
