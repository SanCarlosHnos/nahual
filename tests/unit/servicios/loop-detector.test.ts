// Tests unitarios para LoopDetector
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopDetector, CONFIG_LOOP_DEFAULT } from '../../../src/servicios/loop-detector.js';
import type { Accion } from '../../../src/protocolo.js';

describe('LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  const crearAccion = (tipo: string, ruta: string): Accion => {
    return {
      tipo: tipo as any,
      ruta,
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
    };
  };

  it('no detecta atasco con pocas huellas', () => {
    detector.registrar([crearAccion('leer', 'a.ts')]);
    detector.registrar([crearAccion('leer', 'a.ts')]);
    expect(detector.detectarAtasco()).toBe(false);
  });

  it('detecta atasco con repeticiones suficientes', () => {
    for (let i = 0; i < CONFIG_LOOP_DEFAULT.repeticionesParaAtasco; i++) {
      detector.registrar([crearAccion('leer', 'a.ts')]);
    }
    expect(detector.detectarAtasco()).toBe(true);
  });

  it('no detecta atasco con acciones diferentes', () => {
    detector.registrar([crearAccion('leer', 'a.ts')]);
    detector.registrar([crearAccion('leer', 'b.ts')]);
    detector.registrar([crearAccion('leer', 'c.ts')]);
    expect(detector.detectarAtasco()).toBe(false);
  });

  it('respeta la ventana de huellas', () => {
    // Llenar con acciones diferentes
    for (let i = 0; i < CONFIG_LOOP_DEFAULT.ventanaHuellas; i++) {
      detector.registrar([crearAccion('leer', `file${i}.ts`)]);
    }
    // Agregar repeticiones al final
    for (let i = 0; i < CONFIG_LOOP_DEFAULT.repeticionesParaAtasco; i++) {
      detector.registrar([crearAccion('escribir', 'x.ts')]);
    }
    expect(detector.detectarAtasco()).toBe(true);
  });

  it('reinicia el historial correctamente', () => {
    detector.registrar([crearAccion('leer', 'a.ts')]);
    detector.registrar([crearAccion('leer', 'a.ts')]);
    detector.registrar([crearAccion('leer', 'a.ts')]);
    expect(detector.detectarAtasco()).toBe(true);

    detector.reiniciar();
    expect(detector.detectarAtasco()).toBe(false);
    expect(detector.obtenerHistorial().length).toBe(0);
  });

  it('obtiene la última huella', () => {
    expect(detector.ultimaHuella()).toBe(null);
    detector.registrar([crearAccion('leer', 'a.ts')]);
    expect(detector.ultimaHuella()).toBe('leer a.ts');
    detector.registrar([crearAccion('escribir', 'b.ts')]);
    expect(detector.ultimaHuella()).toBe('escribir b.ts');
  });

  it('ignora acciones sin huella', () => {
    detector.registrar([]);
    detector.registrar([]);
    detector.registrar([]);
    expect(detector.detectarAtasco()).toBe(false);
    expect(detector.obtenerHistorial().length).toBe(0);
  });

  it('permite configuración personalizada', () => {
    const custom = new LoopDetector({ ventanaHuellas: 3, repeticionesParaAtasco: 2 });
    custom.registrar([crearAccion('leer', 'a.ts')]);
    custom.registrar([crearAccion('leer', 'a.ts')]);
    expect(custom.detectarAtasco()).toBe(true);
  });
});
