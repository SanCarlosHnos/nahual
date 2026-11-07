// Interfaz gráfica: el motor (este proceso) habla con la ventana de Electron mediante
// mensajes JSON por la salida y la entrada estándar. Cada mensaje de control lleva un
// prefijo para no confundirse con texto suelto. La ventana responde a «leer» y «elegir».
import * as readline from 'node:readline';
import type { Evento, Interfaz } from './tipos';

export const PREFIJO = '\u0001NJ:';

interface Pendiente {
  resolver: (valor: string | number | null) => void;
  tipo: 'leer' | 'elegir';
}

export function crearInterfazGrafica(): Interfaz {
  let contador = 0;
  const pendientes = new Map<number, Pendiente>();
  let alInterrumpir: () => void = () => {};

  const enviar = (objeto: unknown): void => {
    process.stdout.write(PREFIJO + JSON.stringify(objeto) + '\n');
  };

  const lector = readline.createInterface({ input: process.stdin });
  lector.on('line', (linea) => {
    let msg: { t?: string; id?: number; valor?: string | number };
    try {
      msg = JSON.parse(linea);
    } catch {
      return;
    }
    if (msg.t === 'interrumpir') {
      alInterrumpir();
      return;
    }
    if (msg.t === 'respuesta' && typeof msg.id === 'number') {
      const p = pendientes.get(msg.id);
      if (p) {
        pendientes.delete(msg.id);
        p.resolver(msg.valor ?? null);
      }
    }
  });
  lector.on('close', () => {
    for (const p of pendientes.values()) p.resolver(null);
    pendientes.clear();
  });

  return {
    emitir(evento: Evento) {
      enviar({ t: 'evento', e: evento });
    },
    leer(indicacion) {
      const id = ++contador;
      return new Promise<string | null>((resolver) => {
        pendientes.set(id, {
          tipo: 'leer',
          resolver: (v) => resolver(v === null ? null : String(v)),
        });
        enviar({ t: 'leer', id, indicacion });
      });
    },
    elegir(pregunta, opciones, detalle) {
      const id = ++contador;
      return new Promise<number>((resolver) => {
        pendientes.set(id, {
          tipo: 'elegir',
          resolver: (v) => resolver(typeof v === 'number' ? v : opciones.length - 1),
        });
        enviar({ t: 'elegir', id, pregunta, opciones, detalle });
      });
    },
    alInterrumpir(funcion) {
      alInterrumpir = funcion;
    },
    cerrar() {
      lector.close();
    },
  };
}
