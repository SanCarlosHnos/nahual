// Tests unitarios para ConversationManager
import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../../../src/servicios/conversation-manager.js';
import type { Mensaje } from '../../../src/ollama.js';

describe('ConversationManager', () => {
  let manager: ConversationManager;
  const systemPrompt = 'Eres un asistente útil.';
  const ejemplo: Mensaje[] = [
    { role: 'user', content: 'Ejemplo de usuario' },
    { role: 'assistant', content: 'Ejemplo de asistente' },
  ];

  beforeEach(() => {
    manager = new ConversationManager(systemPrompt, ejemplo);
  });

  it('inicializa con system prompt y ejemplo', () => {
    expect(manager.longitud()).toBe(3); // system + 2 ejemplo
    expect(manager.obtenerInicio()).toBe(3);
    expect(manager.obtener(0)?.role).toBe('system');
    expect(manager.obtener(0)?.content).toBe(systemPrompt);
  });

  it('agrega mensajes al final', () => {
    manager.agregar({ role: 'user', content: 'Hola' });
    expect(manager.longitud()).toBe(4);
    expect(manager.obtener(3)?.content).toBe('Hola');
  });

  it('calcula tamaño total en caracteres', () => {
    const tamanoInicial = systemPrompt.length + ejemplo[0].content.length + ejemplo[1].content.length;
    expect(manager.tamano()).toBe(tamanoInicial);

    manager.agregar({ role: 'user', content: 'Test' });
    expect(manager.tamano()).toBe(tamanoInicial + 4);
  });

  it('modifica contenido de mensajes existentes', () => {
    manager.agregar({ role: 'user', content: 'Original' });
    manager.modificar(3, 'Modificado');
    expect(manager.obtener(3)?.content).toBe('Modificado');
  });

  it('no modifica mensajes fuera de rango', () => {
    manager.modificar(999, 'Test');
    expect(manager.longitud()).toBe(3); // Sin cambios
  });

  it('obtiene los últimos N mensajes', () => {
    manager.agregar({ role: 'user', content: 'Uno' });
    manager.agregar({ role: 'assistant', content: 'Dos' });
    manager.agregar({ role: 'user', content: 'Tres' });

    const ultimos2 = manager.ultimos(2);
    expect(ultimos2.length).toBe(2);
    expect(ultimos2[0].content).toBe('Dos');
    expect(ultimos2[1].content).toBe('Tres');
  });

  it('obtiene mensajes recientes excluyendo system y ejemplo', () => {
    manager.agregar({ role: 'user', content: 'Uno' });
    manager.agregar({ role: 'assistant', content: 'Dos' });

    const recientes = manager.mensajesRecientes();
    expect(recientes.length).toBe(2);
    expect(recientes[0].content).toBe('Uno');
    expect(recientes[1].content).toBe('Dos');
  });

  it('excluye últimos N mensajes recientes', () => {
    manager.agregar({ role: 'user', content: 'Uno' });
    manager.agregar({ role: 'assistant', content: 'Dos' });
    manager.agregar({ role: 'user', content: 'Tres' });

    const recientes = manager.mensajesRecientes(1);
    expect(recientes.length).toBe(2);
    expect(recientes[0].content).toBe('Uno');
    expect(recientes[1].content).toBe('Dos');
  });

  it('elimina mensajes preservando system y ejemplo', () => {
    manager.agregar({ role: 'user', content: 'Uno' });
    manager.agregar({ role: 'assistant', content: 'Dos' });
    manager.agregar({ role: 'user', content: 'Tres' });

    manager.eliminarEn(4); // Eliminar 'Dos'
    expect(manager.longitud()).toBe(5);
    expect(manager.obtener(4)?.content).toBe('Tres');
  });

  it('no elimina mensajes del system o ejemplo', () => {
    manager.eliminarEn(0); // Intentar eliminar system
    manager.eliminarEn(1); // Intentar eliminar ejemplo
    expect(manager.longitud()).toBe(3); // Sin cambios
  });

  it('limpia historial manteniendo últimos N', () => {
    for (let i = 0; i < 10; i++) {
      manager.agregar({ role: 'user', content: `Mensaje ${i}` });
    }
    expect(manager.longitud()).toBe(13); // 3 inicial + 10

    manager.limpiarHasta(5);
    expect(manager.longitud()).toBe(5); // system + 2 ejemplo + 2 mensajes
    expect(manager.obtener(3)?.content).toBe('Mensaje 8');
    expect(manager.obtener(4)?.content).toBe('Mensaje 9');
  });

  it('verifica si excede presupuesto', () => {
    expect(manager.excedePresupuesto(1000000)).toBe(false);
    expect(manager.excedePresupuesto(10)).toBe(true);
  });

  it('obtiene historial completo', () => {
    manager.agregar({ role: 'user', content: 'Test' });
    const historial = manager.obtenerHistorial();
    expect(historial.length).toBe(4);
    expect(historial[3].content).toBe('Test');
  });
});
