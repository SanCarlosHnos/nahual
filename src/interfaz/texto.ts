// Interfaz de texto simple: se usa cuando la entrada no es una terminal interactiva (pruebas, tuberías).
import * as readline from 'node:readline';
import { formatearEvento, formatearPlan, pintar } from './formato';
import type { Evento, Interfaz } from './tipos';

export function crearInterfazTexto(): Interfaz {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: !!process.stdin.isTTY,
  });
  const cola: string[] = [];
  let esperando: ((linea: string | null) => void) | null = null;
  let cerrada = false;
  let alInterrumpir: () => void = () => process.exit(0);

  rl.on('line', (linea) => {
    if (esperando) {
      const resolver = esperando;
      esperando = null;
      resolver(linea);
    } else cola.push(linea);
  });
  rl.on('close', () => {
    cerrada = true;
    esperando?.(null);
    esperando = null;
  });
  rl.on('SIGINT', () => alInterrumpir());

  const pedirLinea = (indicacion: string): Promise<string | null> => {
    const enCola = cola.shift();
    if (enCola !== undefined) {
      process.stdout.write(indicacion + enCola + '\n');
      return Promise.resolve(enCola);
    }
    if (cerrada) return Promise.resolve(null);
    rl.setPrompt(indicacion);
    rl.prompt();
    return new Promise((resolver) => (esperando = resolver));
  };

  return {
    emitir(e: Evento) {
      if (e.tipo === 'pensando') {
        if (e.activo) console.log(pintar('magenta', `✻ ${e.etiqueta ?? 'Pensando'}…`));
        return;
      }
      if (e.tipo === 'plan' && !e.fijo) {
        if (e.pasos.every((p) => !p.hecho))
          console.log('\n' + pintar('bold', '  Plan') + '\n' + formatearPlan(e.pasos));
        return;
      }
      const texto = formatearEvento(e);
      if (texto !== null) console.log(texto);
    },
    leer(indicacion) {
      return pedirLinea(pintar(['bold', 'magenta'], indicacion ? `${indicacion} › ` : '› '));
    },
    async elegir(pregunta, opciones, detalle) {
      console.log('\n' + pintar(['bold', 'yellow'], pregunta));
      if (detalle) console.log(pintar('cyan', detalle));
      opciones.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
      const respuesta = ((await pedirLinea(pintar('yellow', 'Elige un número › '))) ?? '')
        .trim()
        .toLowerCase();
      const numero = Number(respuesta);
      if (numero >= 1 && numero <= opciones.length) return numero - 1;
      if (['s', 'si', 'sí'].includes(respuesta)) return 0;
      return opciones.length - 1;
    },
    alInterrumpir(funcion) {
      alInterrumpir = funcion;
    },
    cerrar() {
      rl.close();
    },
  };
}
