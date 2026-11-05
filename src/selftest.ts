// Autopruebas: se ejecutan antes de aceptar cualquier mejora de Forja.
// Al añadir lógica nueva, añade aquí sus comprobaciones.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commands } from './commands';
import { DEFAULTS } from './config';
import { PROTECTED_SELF, ROOT } from './paths';
import { evolveSystemPrompt, taskSystemPrompt } from './prompts';
import { parseActions, stripThinking, unfence } from './protocol';
import { applyEdit, resolveSafe } from './tools';

let failures = 0;
function check(name: string, condition: boolean): void {
  if (condition) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.log(`  ✖ ${name}`);
  }
}

const c = (n: string): string => '<' + '/' + n + '>';
const lt7 = '<'.repeat(7);
const gt7 = '>'.repeat(7);

// Protocolo
const sample = [
  'Plan: crear archivo.',
  '<list path="."/>',
  '<read path="src/a.ts"/>',
  '<search pattern="foo" path="src"/>',
  '<write path="b.ts">',
  '```ts',
  'export const b = 1;',
  '```',
  c('write'),
  '<edit path="src/a.ts">',
  `${lt7} SEARCH`,
  'const a = 1;',
  '=======',
  'const a = 2;',
  `${gt7} REPLACE`,
  c('edit'),
  '<run>npm test' + c('run'),
  '<done>listo' + c('done'),
].join('\n');
const actions = parseActions(sample);
check('parsea 7 acciones en orden', actions.map((a) => a.type).join(',') === 'list,read,search,write,edit,run,done');
const write = actions[3];
check('write quita las vallas markdown', write?.type === 'write' && write.content === 'export const b = 1;\n');
const edit = actions[4];
check('edit extrae el bloque', edit?.type === 'edit' && edit.blocks[0]?.search === 'const a = 1;' && edit.blocks[0]?.replace === 'const a = 2;');
check('ignora bloques <think>', parseActions('<think><read path="x"/></think>hola').length === 0);
check('stripThinking deja el texto', stripThinking('<think>x</think>hola') === 'hola');
check('unfence sin vallas', unfence('\nabc') === 'abc');

// Edición
check('applyEdit exacto', applyEdit('a\nb\nc', 'b', 'B') === 'a\nB\nc');
check('applyEdit tolera indentación', applyEdit('  if (x) {\n    y();\n  }', 'if (x) {\ny();', 'if (z) {\n    w();') === 'if (z) {\n    w();\n  }');
check('applyEdit conserva CRLF', applyEdit('a\r\nb', 'b', 'c') === 'a\r\nc');
check('applyEdit falla si no encaja', applyEdit('abc', 'zzz', 'y') === null);

// Seguridad de rutas
let escaped = false;
try {
  resolveSafe(ROOT, '../fuera.txt');
} catch {
  escaped = true;
}
check('resolveSafe bloquea ../', escaped);

// Configuración, prompts y comandos
check('config por defecto válida', DEFAULTS.numCtx > 0 && DEFAULTS.maxSteps > 0);
check('prompt de tareas se genera', taskSystemPrompt(ROOT).includes('Forja'));
check('prompt de mejora se genera', evolveSystemPrompt().includes('ADN'));
const names = commands.map((x) => x.name);
check('comandos únicos', new Set(names).size === names.length);
check('existen /mejorar y /ayuda', names.includes('mejorar') && names.includes('ayuda'));
check('núcleo y supervisor protegidos', PROTECTED_SELF.includes('nucleo') && PROTECTED_SELF.includes('supervisor.mjs'));

// Regla crítica: ningún archivo de src contiene etiquetas de cierre literales
const forbidden = ['write', 'edit', 'run', 'done'].map(c);
const srcDir = join(ROOT, 'src');
const offenders = readdirSync(srcDir)
  .filter((f) => f.endsWith('.ts'))
  .filter((f) => forbidden.some((tag) => readFileSync(join(srcDir, f), 'utf8').includes(tag)));
check(`sin etiquetas de cierre literales en src/ ${offenders.join(', ')}`, offenders.length === 0);

if (failures) {
  console.log(`\n${failures} prueba(s) fallida(s)`);
  process.exit(1);
}
console.log('\nTodas las autopruebas pasaron.');
