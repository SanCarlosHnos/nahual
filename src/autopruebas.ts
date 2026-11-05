// Autopruebas: se ejecutan antes de aceptar cualquier mejora de Nahual.
// Al agregar lógica nueva, agrega aquí sus comprobaciones.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comandos } from './comandos';
import { PREDETERMINADA } from './config';
import { resumenEquipo } from './equipo';
import { quitarNoProsa, revisarIdioma } from './idioma';
import { abrir, cerrar, ejemploDeTrabajo, indicacionesDeMejora, indicacionesDeTareas } from './indicaciones';
import { interpretarClasificacion } from './intencion';
import { textoModelfile } from './modelo';
import { analizarAcciones, describirAccion, extraerTexto } from './protocolo';
import { aplicarEdicion, rutaSegura } from './herramientas';
import { PROTEGIDOS, RAIZ } from './rutas';

let fallos = 0;
function comprobar(nombre: string, condicion: boolean): void {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    fallos++;
    console.log(`  ✖ ${nombre}`);
  }
}

const c = (n: string): string => cerrar(n);
const men7 = '<'.repeat(7);
const may7 = '>'.repeat(7);

// Protocolo: analiza una respuesta con todas las acciones
const ejemplo = [
  'Primero reviso.',
  '<listar ruta="."/>',
  '<leer ruta="src/a.ts"/>',
  '<buscar patron="foo" ruta="src"/>',
  '<plan>',
  '1. uno',
  '2. dos',
  c('plan'),
  '<escribir ruta="b.ts">',
  '```ts',
  'export const b = 1;',
  '```',
  c('escribir'),
  '<editar ruta="src/a.ts">',
  `${men7} BUSCAR`,
  'const a = 1;',
  '=======',
  'const a = 2;',
  `${may7} REEMPLAZAR`,
  c('editar'),
  '<hecho paso="1"/>',
  '<ejecutar>npm test' + c('ejecutar'),
  '<recordar>le gusta el modo oscuro' + c('recordar'),
  '<equipo buscar="python"/>',
  '<terminar>listo' + c('terminar'),
].join('\n');
const acciones = analizarAcciones(ejemplo);
comprobar(
  'analiza todas las acciones en orden',
  acciones.map((a) => a.tipo).join(',') === 'listar,leer,buscar,plan,escribir,editar,hecho,ejecutar,recordar,equipo,terminar',
);
const escribir = acciones[4];
comprobar('escribir quita las vallas markdown', escribir?.tipo === 'escribir' && escribir.contenido === 'export const b = 1;\n');
const editar = acciones[5];
comprobar('editar extrae el bloque', editar?.tipo === 'editar' && editar.bloques[0]?.buscar === 'const a = 1;' && editar.bloques[0]?.reemplazar === 'const a = 2;');
const plan = acciones[3];
comprobar('plan extrae los pasos', plan?.tipo === 'plan' && plan.pasos.length === 2 && plan.pasos[0] === 'uno');
comprobar('acepta etiquetas en inglés', analizarAcciones('<read path="x"/>').length === 1);
// El modelo local a veces omite el «>» de apertura: debe reconocerse igual y detectar el fin.
const sinMayor = analizarAcciones('<terminarListo, ya quedó.' + c('terminar'));
comprobar('tolera que falte el «>» en terminar', sinMayor.length === 1 && sinMayor[0]?.tipo === 'terminar');
comprobar('tolera que falte el «>» en escribir', analizarAcciones('<escribir ruta="a.txt"hola' + c('escribir'))[0]?.tipo === 'escribir');
comprobar('ignora bloques de razonamiento', analizarAcciones('<think><leer ruta="x"/></think>hola').length === 0);
comprobar('extraerTexto quita las acciones', extraerTexto('hola <leer ruta="x"/> mundo').includes('hola') && !extraerTexto('hola <leer ruta="x"/>').includes('leer'));
comprobar('describirAccion da nombre en español', describirAccion(acciones[0]!).nombre === 'Listar');

// Edición
comprobar('aplicarEdicion exacto', aplicarEdicion('a\nb\nc', 'b', 'B') === 'a\nB\nc');
comprobar('aplicarEdicion tolera sangría', aplicarEdicion('  if (x) {\n    y();\n  }', 'if (x) {\ny();', 'if (z) {\n    w();') === 'if (z) {\n    w();\n  }');
comprobar('aplicarEdicion conserva CRLF', aplicarEdicion('a\r\nb', 'b', 'c') === 'a\r\nc');
comprobar('aplicarEdicion falla si no encaja', aplicarEdicion('abc', 'zzz', 'y') === null);

// Seguridad de rutas
let escapo = false;
try {
  rutaSegura(RAIZ, '../fuera.txt');
} catch {
  escapo = true;
}
comprobar('rutaSegura bloquea salir de la carpeta', escapo);

// Idioma
comprobar('idioma acepta español latino', revisarIdioma('Voy a crear el archivo y comprobar que funcione.').ok);
comprobar('idioma rechaza inglés', !revisarIdioma('I will create the file and then we are going to test it here now.').ok);
comprobar('idioma rechaza español de España', !revisarIdioma('Vosotros podéis usar el ordenador y el fichero.').ok);
comprobar('idioma ignora el código', revisarIdioma('Creé la función:\n```js\nconst file = true; // the end\n```\nYa quedó lista.').ok);
comprobar('quitarNoProsa quita rutas', !quitarNoProsa('mira el archivo src/app.ts ahora').includes('app'));

// Intención
comprobar('clasificación entiende MEJORA', interpretarClasificacion('MEJORA') === 'mejora');
comprobar('clasificación entiende TAREA', interpretarClasificacion('la respuesta es TAREA') === 'tarea');

// Indicaciones y modelo
comprobar('indicaciones de tareas en español', indicacionesDeTareas(RAIZ, { equipo: '', memoria: '' }).includes('español latinoamericano'));
comprobar('indicaciones de mejora mencionan el taller', indicacionesDeMejora(RAIZ).includes('taller'));
comprobar('ejemplo de trabajo presente', ejemploDeTrabajo().length >= 6);
comprobar('Modelfile incluye la personalidad', textoModelfile('base', 8192).includes('FROM base') && textoModelfile('base', 8192).includes('Nahual'));

// Configuración y comandos
comprobar('configuración por defecto válida', PREDETERMINADA.contexto > 0 && PREDETERMINADA.maxPasos > 0 && !!PREDETERMINADA.modeloBase);
const nombres = comandos.map((x) => x.nombre);
comprobar('comandos con nombre único', new Set(nombres).size === nombres.length);
comprobar('existen los comandos clave', ['ayuda', 'mejorar', 'deshacer', 'salir', 'equipo'].every((n) => nombres.includes(n)));
comprobar('núcleo y supervisor protegidos', PROTEGIDOS.includes('nucleo') && PROTEGIDOS.includes('supervisor.mjs'));
comprobar('resumen de equipo sin datos no truena', typeof resumenEquipo(null) === 'string');

// Regla crítica: ningún archivo de src contiene etiquetas de cierre literales
const prohibidas = ['escribir', 'editar', 'ejecutar', 'terminar', 'write', 'edit', 'run', 'done'].map(c);
function recorrerSrc(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...recorrerSrc(ruta));
    else if (/\.tsx?$/.test(e.name) && prohibidas.some((tag) => readFileSync(ruta, 'utf8').includes(tag))) salida.push(e.name);
  }
  return salida;
}
const infractores = recorrerSrc(join(RAIZ, 'src'));
comprobar(`sin etiquetas de cierre literales en src/ ${infractores.join(', ')}`, infractores.length === 0);

// Referencia para evitar un "no usado" y comprobar que abrir() funciona
comprobar('abrir genera etiqueta', abrir('leer') === '<leer');

if (fallos) {
  console.log(`\n${fallos} prueba(s) fallida(s)`);
  process.exit(1);
}
console.log('\nTodas las autopruebas pasaron.');
