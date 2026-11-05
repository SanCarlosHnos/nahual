import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Agente } from './agente';
import { guardarConfig, type Config } from './config';
import { recolectarEquipo, resumenEquipo, type Inventario } from './equipo';
import { git } from './git';
import type { Interfaz, SugerenciaComando } from './interfaz/tipos';
import { listarModelos, modeloInstalado } from './ollama';
import { VERSION } from './rutas';

export interface Estado {
  cfg: Config;
  carpeta: string;
  agente: Agente | null;
  equipo: Inventario | null;
  ui: Interfaz;
}

export interface ContextoComando {
  estado: Estado;
  argumentos: string;
  senal: AbortSignal;
}

/** 'salir' cierra Nahual; 'reiniciar' recarga el código; 'mejorar' pide al guardián aplicar una mejora. */
export type ResultadoComando = void | 'salir' | 'reiniciar' | 'mejorar';

export interface Comando {
  nombre: string;
  argumentos?: string;
  descripcion: string;
  ejecutar: (ctx: ContextoComando) => Promise<ResultadoComando>;
}

// Para agregar un comando nuevo, basta con añadir un objeto a esta lista.
export const comandos: Comando[] = [
  {
    nombre: 'ayuda',
    descripcion: 'Muestra esta ayuda',
    async ejecutar({ estado }) {
      const lineas = [
        'Escribe lo que necesites en lenguaje normal:',
        '  • «hazme una página para mi negocio» → construyo el proyecto',
        '  • «quiero que puedas leer archivos PDF» → me mejoro a mí mismo (con tu permiso)',
        '',
        'Comandos:',
        ...comandos.map((c) => `  /${c.nombre}${c.argumentos ? ' ' + c.argumentos : ''}  —  ${c.descripcion}`),
        '',
        'Esc o Ctrl+C: interrumpe lo que esté haciendo.',
      ];
      estado.ui.emitir({ tipo: 'bloque', titulo: 'Ayuda de Nahual', lineas });
    },
  },
  {
    nombre: 'mejorar',
    argumentos: '<qué quieres que aprenda o cambie de sí mismo>',
    descripcion: 'Me mejoro a mí mismo: te muestro un plan, lo apruebas y el guardián lo verifica antes de aplicarlo',
    async ejecutar({ estado, argumentos }) {
      if (!argumentos) {
        estado.ui.emitir({ tipo: 'aviso', texto: 'Dime qué quieres que mejore. Ejemplo: /mejorar que tus respuestas sean más cortas' });
        return;
      }
      const archivo = process.env.NAHUAL_PETICION;
      if (!archivo) {
        estado.ui.emitir({ tipo: 'error', texto: 'Las mejoras solo funcionan si abres Nahual con el comando "nahual" (el supervisor).' });
        return;
      }
      mkdirSync(dirname(archivo), { recursive: true });
      writeFileSync(archivo, JSON.stringify({ instruccion: argumentos, fecha: new Date().toISOString() }));
      return 'mejorar';
    },
  },
  {
    nombre: 'deshacer',
    descripcion: 'Revierte mi última mejora y me reinicia',
    async ejecutar({ estado }) {
      const ultimo = git('log', '-1', '--pretty=%s').salida;
      if (!ultimo.startsWith('mejora:')) {
        estado.ui.emitir({ tipo: 'aviso', texto: `Mi último cambio no fue una mejora («${ultimo}»).` });
        return;
      }
      const eleccion = await estado.ui.elegir(`¿Revierto mi última mejora?`, ['Sí', 'No'], ultimo);
      if (eleccion !== 0) return;
      const r = git('revert', '--no-edit', 'HEAD');
      if (!r.ok) {
        estado.ui.emitir({ tipo: 'error', texto: r.salida });
        return;
      }
      estado.ui.emitir({ tipo: 'exito', texto: 'Mejora revertida.' });
      return 'reiniciar';
    },
  },
  {
    nombre: 'historial',
    descripcion: 'Muestra cómo he ido evolucionando',
    async ejecutar({ estado }) {
      const registro = git('log', '--pretty=format:%h  %ad  %s', '--date=short', '-n', '30').salida;
      estado.ui.emitir({ tipo: 'bloque', titulo: 'Mi evolución', lineas: (registro || '(sin historial)').split('\n') });
    },
  },
  {
    nombre: 'equipo',
    descripcion: 'Muestra lo que sé de tu computadora',
    async ejecutar({ estado }) {
      estado.ui.emitir({ tipo: 'info', texto: 'Revisando tu equipo…' });
      estado.equipo = (await recolectarEquipo()) ?? estado.equipo;
      const modelos = await listarModelos(estado.cfg).catch(() => [] as string[]);
      estado.ui.emitir({ tipo: 'bloque', titulo: 'Tu equipo', lineas: resumenEquipo(estado.equipo, modelos).split('\n') });
    },
  },
  {
    nombre: 'modelo',
    argumentos: '[nombre]',
    descripcion: 'Muestra o cambia el modelo de Ollama que uso',
    async ejecutar({ estado, argumentos }) {
      if (!argumentos) {
        estado.ui.emitir({ tipo: 'info', texto: `Uso el modelo: ${estado.cfg.modelo}` });
        return;
      }
      const modelos = await listarModelos(estado.cfg).catch(() => [] as string[]);
      if (modelos.length && !modeloInstalado(modelos, argumentos)) {
        estado.ui.emitir({ tipo: 'aviso', texto: `«${argumentos}» no aparece en Ollama; lo usaré de todos modos.` });
      }
      estado.cfg.modelo = argumentos;
      guardarConfig(estado.cfg);
      estado.agente = null;
      estado.ui.emitir({ tipo: 'exito', texto: `Ahora uso el modelo ${argumentos}.` });
    },
  },
  {
    nombre: 'modelos',
    descripcion: 'Lista los modelos instalados en Ollama',
    async ejecutar({ estado }) {
      const modelos = await listarModelos(estado.cfg);
      estado.ui.emitir({
        tipo: 'bloque',
        titulo: 'Modelos de Ollama',
        lineas: modelos.map((m) => (modeloInstalado([m], estado.cfg.modelo) ? `● ${m}` : `  ${m}`)),
      });
    },
  },
  {
    nombre: 'carpeta',
    argumentos: '[ruta]',
    descripcion: 'Muestra o cambia la carpeta donde construyo tus proyectos',
    async ejecutar({ estado, argumentos }) {
      if (!argumentos) {
        estado.ui.emitir({ tipo: 'info', texto: `Carpeta de trabajo: ${estado.carpeta}` });
        return;
      }
      const destino = resolve(estado.carpeta, argumentos);
      if (!existsSync(destino)) mkdirSync(destino, { recursive: true });
      estado.carpeta = destino;
      estado.agente = null;
      estado.ui.emitir({ tipo: 'estado', carpeta: destino });
      estado.ui.emitir({ tipo: 'exito', texto: `Trabajaré en: ${destino}` });
    },
  },
  {
    nombre: 'nuevo',
    descripcion: 'Empieza una conversación de tarea desde cero',
    async ejecutar({ estado }) {
      estado.agente = null;
      estado.ui.emitir({ tipo: 'exito', texto: 'Conversación reiniciada.' });
    },
  },
  {
    nombre: 'version',
    descripcion: 'Muestra mi versión',
    async ejecutar({ estado }) {
      estado.ui.emitir({ tipo: 'info', texto: `Nahual ${VERSION}` });
    },
  },
  {
    nombre: 'reiniciar',
    descripcion: 'Me reinicia (recarga mi código)',
    async ejecutar() {
      return 'reiniciar';
    },
  },
  {
    nombre: 'salir',
    descripcion: 'Cierra Nahual',
    async ejecutar() {
      return 'salir';
    },
  },
];

export function buscarComando(nombre: string): Comando | undefined {
  return comandos.find((c) => c.nombre === nombre);
}

export function sugerencias(): SugerenciaComando[] {
  return comandos.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion }));
}
