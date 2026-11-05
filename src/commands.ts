import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Agent } from './agent';
import { saveConfig, type Config } from './config';
import { git } from './git';
import { listModels } from './ollama';
import { ui } from './ui';

export interface AppState {
  cfg: Config;
  workdir: string;
  /** Conversación de tareas en curso (se mantiene entre mensajes hasta /nuevo). */
  agent: Agent | null;
}

export interface CommandContext {
  state: AppState;
  confirm: (q: string) => Promise<boolean>;
  signal: AbortSignal;
}

/**
 * 'exit' cierra Forja; 'restart' la reinicia cargando el código nuevo;
 * 'evolve' sale con código 43 para que el guardián aplique la mejora pedida.
 */
export type CommandOutcome = void | 'exit' | 'restart' | 'evolve';

export interface Command {
  name: string;
  args?: string;
  description: string;
  run: (args: string, ctx: CommandContext) => Promise<CommandOutcome>;
}

// Para añadir un comando nuevo, basta con añadir un objeto a esta lista.
export const commands: Command[] = [
  {
    name: 'ayuda',
    description: 'Muestra esta ayuda',
    async run() {
      console.log(ui.paint('bold', '\nEscribe una instrucción normal para que Forja construya o modifique software en la carpeta de trabajo.'));
      console.log(ui.paint('bold', 'Usa /mejorar para que Forja se modifique a sí misma.\n'));
      for (const c of commands) {
        console.log(`  ${ui.paint('yellow', '/' + c.name)}${c.args ? ' ' + ui.paint('gray', c.args) : ''}  —  ${c.description}`);
      }
      console.log(ui.paint('gray', '\n  Ctrl+C cancela la tarea en curso; si no hay ninguna, sale.\n'));
    },
  },
  {
    name: 'mejorar',
    args: '<qué quieres que aprenda>',
    description: 'Forja mejora su propio código en una copia aislada; el guardián la verifica antes de aplicarla',
    async run(args) {
      if (!args) return ui.warn('Uso: /mejorar <descripción de la mejora>');
      const file = process.env.FORJA_PETICION;
      if (!file) return ui.error('Las mejoras solo funcionan si Forja se abre con el comando "forja" (supervisor).');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ instruccion: args, fecha: new Date().toISOString() }));
      ui.info('Entregando la petición al guardián…');
      return 'evolve';
    },
  },
  {
    name: 'deshacer',
    description: 'Revierte la última mejora y reinicia',
    async run(_args, { confirm }) {
      const last = git('log', '-1', '--pretty=%s').out;
      if (!last.startsWith('mejora:')) return ui.warn(`El último cambio no es una mejora («${last}»).`);
      if (!(await confirm(`¿Revertir «${last}»?`))) return;
      const r = git('revert', '--no-edit', 'HEAD');
      if (!r.ok) return ui.error(r.out);
      ui.ok('Mejora revertida.');
      return 'restart';
    },
  },
  {
    name: 'historial',
    description: 'Muestra la evolución de Forja (commits)',
    async run() {
      console.log(git('log', '--pretty=format:%h  %ad  %s', '--date=short', '-n', '30').out || '(sin historial)');
    },
  },
  {
    name: 'modelo',
    args: '[nombre]',
    description: 'Muestra o cambia el modelo de Ollama',
    async run(args, { state }) {
      if (!args) return ui.info(`Modelo actual: ${state.cfg.model}`);
      const models = await listModels(state.cfg).catch(() => [] as string[]);
      if (models.length && !models.includes(args)) ui.warn(`«${args}» no aparece en Ollama; se usará igualmente.`);
      state.cfg.model = args;
      saveConfig(state.cfg);
      ui.ok(`Modelo cambiado a ${args}`);
    },
  },
  {
    name: 'modelos',
    description: 'Lista los modelos instalados en Ollama',
    async run(_args, { state }) {
      const models = await listModels(state.cfg);
      for (const m of models) console.log((m === state.cfg.model ? ui.paint('green', '● ') : '  ') + m);
    },
  },
  {
    name: 'dir',
    args: '[ruta]',
    description: 'Muestra o cambia la carpeta de trabajo de las tareas',
    async run(args, { state }) {
      if (!args) return ui.info(`Carpeta de trabajo: ${state.workdir}`);
      const target = resolve(state.workdir, args);
      if (!existsSync(target)) mkdirSync(target, { recursive: true });
      state.workdir = target;
      state.agent = null;
      ui.ok(`Carpeta de trabajo: ${target} (conversación reiniciada)`);
    },
  },
  {
    name: 'nuevo',
    description: 'Empieza una conversación de tarea nueva',
    async run(_args, { state }) {
      state.agent = null;
      ui.ok('Conversación reiniciada.');
    },
  },
  {
    name: 'auto',
    args: '[si|no]',
    description: 'Ejecutar comandos sin pedir confirmación',
    async run(args, { state }) {
      if (args === 'si' || args === 'sí') state.cfg.autoApproveCommands = true;
      else if (args === 'no') state.cfg.autoApproveCommands = false;
      saveConfig(state.cfg);
      ui.info(`Autoaprobar comandos: ${state.cfg.autoApproveCommands ? 'sí' : 'no'}`);
    },
  },
  {
    name: 'reiniciar',
    description: 'Reinicia Forja (recarga el código)',
    async run() {
      return 'restart';
    },
  },
  {
    name: 'salir',
    description: 'Cierra Forja',
    async run() {
      return 'exit';
    },
  },
];

export function findCommand(name: string): Command | undefined {
  return commands.find((c) => c.name === name);
}
