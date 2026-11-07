// Tests unitarios para ContextPruner
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextPruner } from '../../../src/servicios/context-pruner.js';
import { ConversationManager } from '../../../src/servicios/conversation-manager.js';
import type { Mensaje } from '../../../src/ollama.js';

describe('ContextPruner', () => {
  let pruner: ContextPruner;
  let conversation: ConversationManager;
  const systemPrompt = 'System prompt';
  const ejemplo: Mensaje[] = [];

  beforeEach(() => {
    pruner = new ContextPruner();
    conversation = new ConversationManager(systemPrompt, ejemplo);
  });

  it('detecta cuando necesita poda', () => {
    conversation.agregar({ role: 'user', content: 'x'.repeat(100) });
    expect(pruner.necesitaPoda(conversation, 50)).toBe(true);
    expect(pruner.necesitaPoda(conversation, 200)).toBe(false);
  });

  it('no poda si no excede presupuesto', () => {
    conversation.agregar({ role: 'user', content: 'Hola' });
    pruner.podar(conversation, 1000, 2);
    expect(conversation.longitud()).toBe(2); // system + user
  });

  it('resume resultados con encabezados', () => {
    const contenido = '### Archivo creado\n```ts\nconst x = 1;\n```\n### Otro archivo';
    conversation.agregar({ role: 'user', content: contenido });
    conversation.agregar({ role: 'assistant', content: 'Listo' });

    pruner.podarResultados(conversation, 1);

    const podado = conversation.obtener(1);
    expect(podado?.content).toContain('RESULTADOS');
    expect(podado?.content).toContain('Archivo creado');
  });

  it('elimina turnos viejos manteniendo recientes', () => {
    for (let i = 0; i < 10; i++) {
      conversation.agregar({ role: 'user', content: `Mensaje ${i}` });
      conversation.agregar({ role: 'assistant', content: `Respuesta ${i}` });
    }

    pruner.podarTurnos(conversation, 5);

    expect(conversation.longitud()).toBe(5);
  });

  it('aplica estrategia completa de poda', () => {
    // Llenar con contenido grande
    for (let i = 0; i < 20; i++) {
      conversation.agregar({ role: 'user', content: `Pregunta ${i}` });
      conversation.agregar({ role: 'assistant', content: `Respuesta ${i}` });
    }

    const tamanoInicial = conversation.tamano();
    pruner.podar(conversation, tamanoInicial / 2, 5);

    expect(conversation.tamano()).toBeLessThan(tamanoInicial);
  });

  it('permite configuración personalizada', () => {
    const custom = new ContextPruner({ factorReduccion: 0.5, maxResumenCaracteres: 100 });
    conversation.agregar({ role: 'user', content: 'Test' });
    expect(custom.necesitaPoda(conversation, 1)).toBe(true);
  });
});
