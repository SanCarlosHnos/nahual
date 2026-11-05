// Protocolo de acciones: el modelo responde con etiquetas tipo XML que Forja ejecuta.
// IMPORTANTE: ningún archivo de src/ debe contener literalmente una etiqueta de cierre
// de acción (barra + nombre). Las expresiones regulares las escapan como <\/...>
// y prompts.ts las construye con funciones auxiliares.

export interface EditBlock {
  search: string;
  replace: string;
}

export type Action =
  | { type: 'read'; path: string }
  | { type: 'list'; path: string }
  | { type: 'search'; pattern: string; path: string }
  | { type: 'write'; path: string; content: string }
  | { type: 'edit'; path: string; blocks: EditBlock[] }
  | { type: 'run'; command: string }
  | { type: 'done'; summary: string };

const Q = `["']([^"']*)["']`;
const ACTION_RE = new RegExp(
  [
    `<(read|list)\\s+path=${Q}\\s*\\/?>`,
    `<search\\s+pattern=${Q}(?:\\s+path=${Q})?\\s*\\/?>`,
    `<write\\s+path=${Q}\\s*>([\\s\\S]*?)<\\/write>`,
    `<edit\\s+path=${Q}\\s*>([\\s\\S]*?)<\\/edit>`,
    `<run>([\\s\\S]*?)<\\/run>`,
    `<done>([\\s\\S]*?)<\\/done>`,
  ].join('|'),
  'g',
);

const BLOCK_RE = /<{7}\s*SEARCH\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n?>{7}\s*REPLACE/g;

/** Elimina los bloques de razonamiento <think> que emiten algunos modelos (qwen3, deepseek-r1). */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
}

/** Quita las vallas ``` si el modelo envolvió el contenido del archivo con ellas. */
export function unfence(content: string): string {
  const fenced = content.match(/^\s*```[\w.+-]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (fenced) return fenced[1] + '\n';
  return content.replace(/^\r?\n/, '');
}

export function parseEditBlocks(body: string): EditBlock[] {
  const blocks: EditBlock[] = [];
  BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCK_RE.exec(body))) blocks.push({ search: m[1] ?? '', replace: m[2] ?? '' });
  return blocks;
}

/** Extrae, en orden, todas las acciones de una respuesta del modelo. */
export function parseActions(text: string): Action[] {
  const clean = stripThinking(text);
  const actions: Action[] = [];
  ACTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ACTION_RE.exec(clean))) {
    if (m[1]) actions.push({ type: m[1] as 'read' | 'list', path: m[2] ?? '.' });
    else if (m[3] !== undefined) actions.push({ type: 'search', pattern: m[3], path: m[4] ?? '.' });
    else if (m[5] !== undefined) actions.push({ type: 'write', path: m[5], content: unfence(m[6] ?? '') });
    else if (m[7] !== undefined) actions.push({ type: 'edit', path: m[7], blocks: parseEditBlocks(m[8] ?? '') });
    else if (m[9] !== undefined) actions.push({ type: 'run', command: m[9].trim() });
    else if (m[10] !== undefined) actions.push({ type: 'done', summary: m[10].trim() });
  }
  return actions;
}

export function describeAction(a: Action): string {
  switch (a.type) {
    case 'read':
      return `leer ${a.path}`;
    case 'list':
      return `listar ${a.path}`;
    case 'search':
      return `buscar /${a.pattern}/ en ${a.path}`;
    case 'write':
      return `escribir ${a.path} (${a.content.split('\n').length} líneas)`;
    case 'edit':
      return `editar ${a.path} (${a.blocks.length} cambio${a.blocks.length === 1 ? '' : 's'})`;
    case 'run':
      return `ejecutar: ${a.command}`;
    case 'done':
      return 'terminar';
  }
}
