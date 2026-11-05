// Formato visual compartido por la interfaz interactiva y la de texto simple.
import { styleText } from 'node:util';
import type { Evento, PasoPlan } from './tipos';

type Estilo = Parameters<typeof styleText>[0];
export const pintar = (estilo: Estilo, texto: string): string => styleText(estilo, texto);

/** Convierte un markdown sencillo en texto con colores para la terminal. */
export function formatearMarkdown(texto: string): string {
  const salida: string[] = [];
  let enCodigo = false;
  for (const linea of texto.split('\n')) {
    if (/^\s*```/.test(linea)) {
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo) {
      salida.push(pintar('cyan', '  ' + linea));
      continue;
    }
    if (/^#{1,6}\s/.test(linea)) {
      salida.push(pintar('bold', linea.replace(/^#{1,6}\s/, '')));
      continue;
    }
    salida.push(
      linea
        .replace(/^(\s*)[-*]\s+/, '$1• ')
        .replace(/\*\*([^*]+)\*\*/g, (_t, x: string) => pintar('bold', x))
        .replace(/`([^`]+)`/g, (_t, x: string) => pintar('cyan', x)),
    );
  }
  return salida.join('\n');
}

const sangrar = (texto: string, prefijo: string): string =>
  texto
    .split('\n')
    .map((l, i) => (i === 0 ? l : prefijo + l))
    .join('\n');

export function formatearPlan(pasos: PasoPlan[]): string {
  return pasos
    .map((p) => (p.hecho ? pintar('green', '  ✔ ') + pintar(['gray', 'strikethrough'], p.texto) : pintar('gray', '  ○ ') + p.texto))
    .join('\n');
}

function caja(lineas: string[]): string {
  const ancho = Math.min(Math.max(...lineas.map((l) => l.length), 40) + 2, (process.stdout.columns || 80) - 2);
  const arriba = pintar('magenta', '╭' + '─'.repeat(ancho) + '╮');
  const abajo = pintar('magenta', '╰' + '─'.repeat(ancho) + '╯');
  const medio = lineas.map((l) => pintar('magenta', '│') + ' ' + l.slice(0, ancho - 1).padEnd(ancho - 1) + pintar('magenta', '│'));
  return [arriba, ...medio, abajo].join('\n');
}

/** Texto de un evento que queda fijo en el historial de la pantalla (null si no se muestra). */
export function formatearEvento(e: Evento): string | null {
  switch (e.tipo) {
    case 'bienvenida':
      return (
        caja([`✻ ${e.titulo}`, '', `  versión ${e.version} · modelo ${e.modelo}`, `  carpeta: ${e.carpeta}`, '', ...e.consejos.map((c) => '  ' + c)]) + '\n'
      );
    case 'usuario':
      return '\n' + pintar('gray', '› ') + e.texto;
    case 'asistente':
      return '\n' + pintar('white', '● ') + sangrar(formatearMarkdown(e.texto), '  ');
    case 'accion':
      return '\n' + pintar('green', '● ') + pintar('bold', e.nombre) + pintar('gray', `(${e.detalle})`);
    case 'resultado': {
      const lineas = [pintar('gray', '  ⎿  ') + sangrar(pintar(e.ok ? 'gray' : 'red', e.resumen), '     ')];
      for (const d of e.diferencias ?? []) {
        lineas.push('     ' + (d.signo === '+' ? pintar('green', '+ ' + d.texto) : pintar('red', '- ' + d.texto)));
      }
      return lineas.join('\n');
    }
    case 'plan':
      return e.fijo ? '\n' + pintar('bold', '  Plan') + '\n' + formatearPlan(e.pasos) : null;
    case 'info':
      return pintar('cyan', '  ' + e.texto);
    case 'exito':
      return pintar('green', '✔ ' + e.texto);
    case 'aviso':
      return pintar('yellow', '⚠ ' + e.texto);
    case 'error':
      return pintar('red', '✖ ' + e.texto);
    case 'bloque':
      return '\n' + pintar('bold', e.titulo) + '\n' + e.lineas.map((l) => '  ' + l).join('\n');
    default:
      return null;
  }
}
