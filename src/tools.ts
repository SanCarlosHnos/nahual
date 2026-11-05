import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Action } from './protocol';

export interface ToolContext {
  /** Carpeta raíz donde el agente puede trabajar. */
  root: string;
  /** Rutas relativas a root que no se pueden modificar. */
  protectedPaths: string[];
  /** Pregunta sí/no al usuario. */
  confirm: (question: string) => Promise<boolean>;
  autoApprove: boolean;
  /** Archivos modificados durante la sesión (relativos a root). */
  changed: Set<string>;
  /** Si es true, el agente debe terminar con la acción done. */
  requireDone: boolean;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.venv', '__pycache__', 'target', 'coverage']);
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|exe|dll|woff2?|ttf|mp[34]|wav|lock)$/i;
const MAX_OUTPUT = 12000;

export function truncate(s: string, max = MAX_OUTPUT): string {
  if (s.length <= max) return s;
  const half = Math.floor(max / 2);
  return `${s.slice(0, half)}\n… [${s.length - max} caracteres omitidos] …\n${s.slice(-half)}`;
}

/** Resuelve una ruta impidiendo salir de root. */
export function resolveSafe(root: string, p: string): string {
  const abs = resolve(root, p || '.');
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Ruta fuera de la carpeta de trabajo: ${p}`);
  return abs;
}

export function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/') || '.';
}

function isProtected(ctx: ToolContext, abs: string): boolean {
  const rel = toRel(ctx.root, abs);
  return ctx.protectedPaths.some((p) => rel === p || rel.startsWith(p + '/'));
}

/**
 * Aplica un bloque SEARCH/REPLACE. Primero busca coincidencia exacta; si no,
 * compara línea a línea ignorando espacios al inicio y final. Devuelve null si no encaja.
 */
export function applyEdit(content: string, search: string, replace: string): string | null {
  if (!search.trim()) return null;
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const c = content.replace(/\r\n/g, '\n');
  const s = search.replace(/\r\n/g, '\n');
  const r = replace.replace(/\r\n/g, '\n');
  let out: string | null = null;
  const idx = c.indexOf(s);
  if (idx >= 0) {
    out = c.slice(0, idx) + r + c.slice(idx + s.length);
  } else {
    const cl = c.split('\n');
    const sl = s.split('\n');
    for (let i = 0; i + sl.length <= cl.length && out === null; i++) {
      let match = true;
      for (let j = 0; j < sl.length; j++) {
        if (cl[i + j]!.trim() !== sl[j]!.trim()) {
          match = false;
          break;
        }
      }
      if (match) out = [...cl.slice(0, i), ...r.split('\n'), ...cl.slice(i + sl.length)].join('\n');
    }
  }
  return out === null ? null : out.replace(/\n/g, eol);
}

function walk(dir: string, visit: (abs: string, isDir: boolean, depth: number) => boolean | void, depth = 0): void {
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORED.has(name)) continue;
    const abs = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (visit(abs, isDir, depth) === false) return;
    if (isDir) walk(abs, visit, depth + 1);
  }
}

export function fileTree(root: string, start = '.', maxDepth = 4, maxEntries = 400): string {
  const base = resolveSafe(root, start);
  if (!existsSync(base)) return '(la carpeta no existe todavía)';
  const lines: string[] = [];
  walk(base, (abs, isDir, depth) => {
    if (lines.length >= maxEntries) {
      lines.push('… (lista recortada)');
      return false;
    }
    if (depth > maxDepth) return;
    lines.push('  '.repeat(depth) + (isDir ? relative(base, abs).split(sep).pop() + '/' : relative(base, abs).split(sep).pop()));
  });
  return lines.length ? lines.join('\n') : '(carpeta vacía)';
}

function searchFiles(root: string, start: string, pattern: string): string {
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const hits: string[] = [];
  walk(resolveSafe(root, start), (abs, isDir) => {
    if (isDir || BINARY.test(abs) || hits.length >= 60) return;
    if (statSync(abs).size > 1_000_000) return;
    const lines = readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (hits.length < 60 && re.test(line)) hits.push(`${toRel(root, abs)}:${i + 1}: ${line.trim().slice(0, 200)}`);
    });
  });
  return hits.length ? hits.join('\n') : 'Sin coincidencias.';
}

export function runCommand(command: string, cwd: string, timeoutMs = 180000): ToolResult {
  const r = spawnSync(command, {
    shell: true,
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  const status = r.error ? `error: ${r.error.message}` : `código de salida ${r.status}`;
  return { ok: !r.error && r.status === 0, output: `[${status}]\n${truncate(output || '(sin salida)')}` };
}

export async function executeAction(action: Action, ctx: ToolContext): Promise<ToolResult> {
  try {
    switch (action.type) {
      case 'read': {
        const abs = resolveSafe(ctx.root, action.path);
        if (!existsSync(abs)) return { ok: false, output: `No existe: ${action.path}` };
        if (statSync(abs).isDirectory()) return { ok: true, output: fileTree(ctx.root, action.path) };
        return { ok: true, output: truncate(readFileSync(abs, 'utf8'), 20000) };
      }
      case 'list':
        return { ok: true, output: fileTree(ctx.root, action.path) };
      case 'search':
        return { ok: true, output: searchFiles(ctx.root, action.path, action.pattern) };
      case 'write': {
        const abs = resolveSafe(ctx.root, action.path);
        if (isProtected(ctx, abs)) return { ok: false, output: `Archivo protegido, no se puede modificar: ${action.path}` };
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, action.content);
        ctx.changed.add(toRel(ctx.root, abs));
        return { ok: true, output: `Escrito ${action.path} (${action.content.length} caracteres).` };
      }
      case 'edit': {
        const abs = resolveSafe(ctx.root, action.path);
        if (isProtected(ctx, abs)) return { ok: false, output: `Archivo protegido, no se puede modificar: ${action.path}` };
        if (!existsSync(abs)) return { ok: false, output: `No existe: ${action.path}. Usa write para crearlo.` };
        if (action.blocks.length === 0) return { ok: false, output: 'El edit no contiene bloques SEARCH/REPLACE válidos.' };
        let content = readFileSync(abs, 'utf8');
        const failed: number[] = [];
        action.blocks.forEach((b, i) => {
          const next = applyEdit(content, b.search, b.replace);
          if (next === null) failed.push(i + 1);
          else content = next;
        });
        if (failed.length) {
          return {
            ok: false,
            output: `Los bloques ${failed.join(', ')} no coinciden con el contenido actual de ${action.path}. Vuelve a leer el archivo y copia las líneas exactas. No se aplicó ningún cambio.`,
          };
        }
        writeFileSync(abs, content);
        ctx.changed.add(toRel(ctx.root, abs));
        return { ok: true, output: `Editado ${action.path} (${action.blocks.length} bloque(s)).` };
      }
      case 'run': {
        const allowed = ctx.autoApprove || (await ctx.confirm(`¿Ejecutar «${action.command}»?`));
        if (!allowed) return { ok: false, output: 'El usuario rechazó ejecutar este comando.' };
        mkdirSync(ctx.root, { recursive: true });
        return runCommand(action.command, ctx.root);
      }
      case 'done':
        return { ok: true, output: action.summary };
    }
  } catch (e) {
    return { ok: false, output: (e as Error).message };
  }
}
