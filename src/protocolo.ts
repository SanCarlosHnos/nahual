// Protocolo de acciones: el modelo responde con etiquetas tipo XML que Nahual ejecuta.
// Las etiquetas son en español; se aceptan también los nombres en inglés por si el modelo se equivoca.
// IMPORTANTE: ningún archivo de src/ debe contener literalmente una etiqueta de cierre de acción.
// Aquí las expresiones regulares escapan la barra (<\/...>) y las indicaciones usan abrir()/cerrar().

export interface BloqueEdicion {
  buscar: string;
  reemplazar: string;
}

export type Accion =
  | { tipo: 'leer'; ruta: string }
  | { tipo: 'listar'; ruta: string }
  | { tipo: 'buscar'; patron: string; ruta: string }
  | { tipo: 'escribir'; ruta: string; contenido: string }
  | { tipo: 'editar'; ruta: string; bloques: BloqueEdicion[] }
  | { tipo: 'ejecutar'; comando: string }
  | { tipo: 'plan'; pasos: string[] }
  | { tipo: 'hecho'; paso: number }
  | { tipo: 'preguntar'; pregunta: string }
  | { tipo: 'recordar'; dato: string }
  | { tipo: 'equipo'; buscar: string }
  | { tipo: 'terminar'; resumen: string };

const Q = `["']([^"']*)["']`;
const RUTA = `(?:ruta|path)`;

// Grupos de captura (numeración global de la expresión combinada):
//  1 nombre leer/listar · 2 ruta · 3 patrón · 4 ruta de búsqueda · 5 nombre escribir · 6 ruta · 7 contenido
//  8 nombre editar · 9 ruta · 10 cuerpo · 11 nombre ejecutar · 12 comando · 13 plan · 14 paso hecho
// 15 pregunta · 16 dato · 17 búsqueda en el equipo · 18 nombre terminar · 19 resumen
// Nota: los modelos locales a veces omiten el «>» de la etiqueta de apertura
// (por ejemplo «<terminarListo…» en vez de «<terminar>Listo…»). Por eso ese «>»
// se marca como opcional (>?) en las etiquetas con cuerpo, y el cierre, que estos
// modelos sí suelen escribir, es el que delimita el contenido.
const EXPRESION_ACCIONES = new RegExp(
  [
    `<(leer|read|listar|list)\\s+${RUTA}=${Q}\\s*\\/?>?`,
    `<(?:buscar|search)\\s+(?:patron|patrón|pattern)=${Q}(?:\\s+${RUTA}=${Q})?\\s*\\/?>?`,
    `<(escribir|write)\\s+${RUTA}=${Q}\\s*>?([\\s\\S]*?)<\\/\\5>`,
    `<(editar|edit)\\s+${RUTA}=${Q}\\s*>?([\\s\\S]*?)<\\/\\8>`,
    `<(ejecutar|run)\\s*>?([\\s\\S]*?)<\\/\\11>`,
    `<plan\\s*>?([\\s\\S]*?)<\\/plan>`,
    `<hecho\\s+paso=["']?(\\d+)["']?\\s*\\/?>?`,
    `<preguntar\\s*>?([\\s\\S]*?)<\\/preguntar>`,
    `<recordar\\s*>?([\\s\\S]*?)<\\/recordar>`,
    `<equipo(?:\\s+buscar=${Q})?\\s*\\/?>?`,
    `<(terminar|done)\\s*>?([\\s\\S]*?)<\\/\\18>`,
  ].join('|'),
  'g',
);

const EXPRESION_BLOQUE =
  /<{7}\s*(?:BUSCAR|SEARCH)\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n?>{7}\s*(?:REEMPLAZAR|REPLACE)/g;

/** Quita los bloques de razonamiento que emiten algunos modelos (qwen3, deepseek-r1). */
export function quitarRazonamiento(texto: string): string {
  return texto.replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
}

/** Quita las vallas ``` si el modelo envolvió el contenido del archivo con ellas. */
export function quitarVallas(contenido: string): string {
  const conVallas = contenido.match(/^\s*```[\w.+-]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (conVallas) return conVallas[1] + '\n';
  return contenido.replace(/^\r?\n/, '');
}

export function analizarBloques(cuerpo: string): BloqueEdicion[] {
  const bloques: BloqueEdicion[] = [];
  EXPRESION_BLOQUE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPRESION_BLOQUE.exec(cuerpo)))
    bloques.push({ buscar: m[1] ?? '', reemplazar: m[2] ?? '' });
  return bloques;
}

export function analizarPlan(cuerpo: string): string[] {
  return cuerpo
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^(\d+[.)-]|[-*•])\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 12);
}

/** Extrae, en orden, todas las acciones de una respuesta del modelo. */
export function analizarAcciones(respuesta: string): Accion[] {
  const limpio = quitarRazonamiento(respuesta);
  const acciones: Accion[] = [];
  EXPRESION_ACCIONES.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPRESION_ACCIONES.exec(limpio))) {
    if (m[1])
      acciones.push({ tipo: /^(leer|read)$/.test(m[1]) ? 'leer' : 'listar', ruta: m[2] ?? '.' });
    else if (m[3] !== undefined) acciones.push({ tipo: 'buscar', patron: m[3], ruta: m[4] ?? '.' });
    else if (m[5])
      acciones.push({ tipo: 'escribir', ruta: m[6] ?? '', contenido: quitarVallas(m[7] ?? '') });
    else if (m[8])
      acciones.push({ tipo: 'editar', ruta: m[9] ?? '', bloques: analizarBloques(m[10] ?? '') });
    else if (m[11]) acciones.push({ tipo: 'ejecutar', comando: (m[12] ?? '').trim() });
    else if (m[13] !== undefined) acciones.push({ tipo: 'plan', pasos: analizarPlan(m[13]) });
    else if (m[14] !== undefined) acciones.push({ tipo: 'hecho', paso: Number(m[14]) });
    else if (m[15] !== undefined) acciones.push({ tipo: 'preguntar', pregunta: m[15].trim() });
    else if (m[16] !== undefined) acciones.push({ tipo: 'recordar', dato: m[16].trim() });
    else if (m[0].startsWith('<equipo'))
      acciones.push({ tipo: 'equipo', buscar: (m[17] ?? '').trim() });
    else if (m[18]) acciones.push({ tipo: 'terminar', resumen: (m[19] ?? '').trim() });
  }
  return acciones;
}

/** El texto de la respuesta sin acciones ni razonamiento: lo que se le muestra al usuario. */
export function extraerTexto(respuesta: string): string {
  return quitarRazonamiento(respuesta)
    .replace(EXPRESION_ACCIONES, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface DescripcionAccion {
  nombre: string;
  detalle: string;
}

export function describirAccion(a: Accion): DescripcionAccion {
  switch (a.tipo) {
    case 'leer':
      return { nombre: 'Leer', detalle: a.ruta };
    case 'listar':
      return { nombre: 'Listar', detalle: a.ruta };
    case 'buscar':
      return { nombre: 'Buscar', detalle: `«${a.patron}» en ${a.ruta}` };
    case 'escribir':
      return { nombre: 'Escribir', detalle: a.ruta };
    case 'editar':
      return { nombre: 'Editar', detalle: a.ruta };
    case 'ejecutar':
      return { nombre: 'Ejecutar', detalle: a.comando };
    case 'equipo':
      return { nombre: 'Equipo', detalle: a.buscar || 'resumen' };
    case 'plan':
      return { nombre: 'Plan', detalle: `${a.pasos.length} pasos` };
    case 'hecho':
      return { nombre: 'Hecho', detalle: `paso ${a.paso}` };
    case 'preguntar':
      return { nombre: 'Preguntar', detalle: a.pregunta };
    case 'recordar':
      return { nombre: 'Recordar', detalle: a.dato };
    case 'terminar':
      return { nombre: 'Terminar', detalle: '' };
  }
}

/**
 * Huella de las acciones para detectar cuando el modelo se queda repitiendo lo mismo.
 * Compara el tipo y el objetivo, nunca el contenido: un espacio distinto en un archivo
 * no debe disfrazar la repetición. Incluye hecho y terminar, que también pueden repetirse.
 */
export function huellaAcciones(acciones: Accion[]): string {
  return acciones
    .map((a): string => {
      switch (a.tipo) {
        case 'leer':
        case 'listar':
        case 'escribir':
        case 'editar':
          return `${a.tipo} ${a.ruta}`;
        case 'buscar':
          return `buscar ${a.patron} ${a.ruta}`;
        case 'ejecutar':
          return `ejecutar ${a.comando}`;
        case 'hecho':
          return `hecho ${a.paso}`;
        case 'preguntar':
          return `preguntar ${a.pregunta}`;
        case 'recordar':
          return `recordar ${a.dato}`;
        case 'equipo':
          return `equipo ${a.buscar}`;
        case 'plan':
        case 'terminar':
          return a.tipo;
      }
    })
    .join(' | ');
}
