// Tests unitarios para ResponseValidator
import { describe, it, expect } from 'vitest';
import { ResponseValidator } from '../../../src/servicios/response-validator.js';
import type { Accion } from '../../../src/protocolo.js';

describe('ResponseValidator', () => {
  const crearAccion = (tipo: string, overrides: Partial<Accion> = {}): Accion => ({
    tipo: tipo as any,
    ruta: '',
    contenido: '',
    bloques: [],
    pasos: [],
    patron: '',
    comando: '',
    paso: '',
    dato: '',
    buscar: '',
    pregunta: '',
    texto: '',
    ...overrides,
  });

  describe('validarTexto', () => {
    it('rechaza texto vacío', () => {
      const validator = new ResponseValidator();
      const result = validator.validarTexto('');
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('vacía');
    });

    it('rechaza texto solo con espacios', () => {
      const validator = new ResponseValidator();
      const result = validator.validarTexto('   \n\t  ');
      expect(result.valida).toBe(false);
    });

    it('rechaza texto demasiado corto', () => {
      const validator = new ResponseValidator({ minLength: 20 });
      const result = validator.validarTexto('corto');
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('corta');
    });

    it('acepta texto válido', () => {
      const validator = new ResponseValidator();
      const result = validator.validarTexto('Esta es una respuesta válida del modelo.');
      expect(result.valida).toBe(true);
    });
  });

  describe('validarAcciones', () => {
    it('rechaza sin acciones cuando es requerido', () => {
      const validator = new ResponseValidator({ requireActions: true });
      const result = validator.validarAcciones([]);
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('acciones');
    });

    it('acepta sin acciones cuando no es requerido', () => {
      const validator = new ResponseValidator({ requireActions: false });
      const result = validator.validarAcciones([]);
      expect(result.valida).toBe(true);
    });

    it('acepta con acciones presentes', () => {
      const validator = new ResponseValidator({ requireActions: true });
      const result = validator.validarAcciones([crearAccion('leer', { ruta: 'a.ts' })]);
      expect(result.valida).toBe(true);
    });
  });

  describe('validarSintaxis', () => {
    it('rechaza escribir sin contenido', () => {
      const validator = new ResponseValidator();
      const result = validator.validarSintaxis([
        crearAccion('escribir', { ruta: 'a.ts', contenido: '' }),
      ]);
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('contenido');
    });

    it('rechaza editar sin bloques', () => {
      const validator = new ResponseValidator();
      const result = validator.validarSintaxis([
        crearAccion('editar', { ruta: 'a.ts', bloques: [] }),
      ]);
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('bloques');
    });

    it('rechaza acciones con ruta vacía', () => {
      const validator = new ResponseValidator();
      const result = validator.validarSintaxis([crearAccion('leer', { ruta: '' })]);
      expect(result.valida).toBe(false);
      expect(result.razon).toContain('ruta');
    });

    it('acepta acciones válidas', () => {
      const validator = new ResponseValidator();
      const result = validator.validarSintaxis([
        crearAccion('leer', { ruta: 'a.ts' }),
        crearAccion('escribir', { ruta: 'b.ts', contenido: 'console.log("hola");' }),
      ]);
      expect(result.valida).toBe(true);
    });
  });

  describe('validarCompleto', () => {
    it('falla si el texto es inválido', () => {
      const validator = new ResponseValidator();
      const result = validator.validarCompleto('', [crearAccion('leer', { ruta: 'a.ts' })]);
      expect(result.valida).toBe(false);
    });

    it('falla si las acciones son inválidas', () => {
      const validator = new ResponseValidator({ requireActions: true });
      const result = validator.validarCompleto('Texto válido', []);
      expect(result.valida).toBe(false);
    });

    it('falla si la sintaxis es inválida', () => {
      const validator = new ResponseValidator();
      const result = validator.validarCompleto('Texto válido', [
        crearAccion('escribir', { ruta: 'a.ts', contenido: '' }),
      ]);
      expect(result.valida).toBe(false);
    });

    it('acepta validación completa exitosa', () => {
      const validator = new ResponseValidator({ requireActions: true });
      const result = validator.validarCompleto('Texto válido', [
        crearAccion('leer', { ruta: 'a.ts' }),
      ]);
      expect(result.valida).toBe(true);
    });
  });
});
