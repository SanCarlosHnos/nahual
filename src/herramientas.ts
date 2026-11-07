import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { buscarEnEquipo, type Inventario } from './equipo';
import type { Interfaz, LineaDiferencia } from './interfaz/tipos';
import type { Accion } from './protocolo';

export interface ContextoHerramientas {
  /** Carpeta raíz donde el agente puede trabajar. */
  raiz: string;
  /** Rutas relativas a la raíz que no se pueden modificar. */
  protegidos: string[];
  ui: Interfaz;
  /** Ejecutar comandos sin pedir permiso. */
  autoAprobar: boolean;
  /** Ofrecer la opción «sí, y no volver a preguntar». */
  permitirSiempre: boolean;
  /** Fase de planeación: no se permite modificar archivos ni ejecutar comandos. */
  soloLectura: boolean;
  /** Archivos modificados (relativos a la raíz). */
  cambiados: Set<string>;
  /** El agente debe terminar con la acción terminar. */
  requiereTerminar: boolean;
  /** Inventario del equipo del usuario. */
  equipo: () => Inventario | null;
}

export interface ResultadoHerramienta {
  ok: boolean;
  /** Texto completo que recibe el modelo. */
  salida: string;
  /** Texto corto que ve el usuario. */
  resumen: string;
  diferencias?: LineaDiferencia[];
}

const IGNORADOS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.venv',
  '__pycache__',
  'target',
  'coverage',
  '.taller',
]);
const BINARIOS =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|exe|dll|woff2?|ttf|mp[34]|wav|lock|sqlite|db)$/i;
const MAX_SALIDA = 12000;
const MAX_DIFERENCIAS = 24;
const MAX_SALIDA_COMANDO = 1_000_000; // 1MB en lugar de 4MB para evitar consumo excesivo de memoria

export function recortar(texto: string, maximo = MAX_SALIDA): string {
  if (texto.length <= maximo) return texto;
  const mitad = Math.floor(maximo / 2);
  return `${texto.slice(0, mitad)}\n… [${texto.length - maximo} caracteres omitidos] …\n${texto.slice(-mitad)}`;
}

/** Resuelve una ruta impidiendo salir de la raíz. */
export function rutaSegura(raiz: string, ruta: string): string {
  const absoluta = resolve(raiz, ruta || '.');
  const rel = relative(raiz, absoluta);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw new Error(`Ruta fuera de la carpeta de trabajo: ${ruta}`);
  return absoluta;
}

export function rutaRelativa(raiz: string, absoluta: string): string {
  return relative(raiz, absoluta).split(sep).join('/') || '.';
}

function esRegexPeligroso(patron: string): boolean {
  // Detectar patrones que pueden causar backtracking catastrófico (ReDoS)
  const patronesPeligrosos = [
    /\([^)]*[+*][^)]*\)[+*]/, // (a+)+ o (a*)*
    /\(\.\*\)\{/, // (.*){n}
    /\([^)]*\|[^)]*\)[+*]/, // (a|b)+ con alternancias superpuestas
  ];
  return patronesPeligrosos.some((p) => p.test(patron));
}

function esComandoPeligroso(comando: string): boolean {
  const comandosPeligrosos = [
    /\b(rm|del)\s+(-rf|--force|-r)\b/, // rm -rf, del /f
    /\bformat\b/, // format
    /\bdd\b/, // dd
    /\bmkfs\b/, // mkfs
    /\b(fdisk|diskpart)\b/, // fdisk, diskpart
  ];
  return comandosPeligrosos.some((p) => p.test(comando));
}

function esProtegida(ctx: ContextoHerramientas, absoluta: string): boolean {
  const rel = rutaRelativa(ctx.raiz, absoluta);
  const esWindows = process.platform === 'win32';
  const normalizar = esWindows ? (s: string) => s.toLowerCase() : (s: string) => s;
  const relNorm = normalizar(rel);
  return ctx.protegidos.some((p) => {
    const pNorm = normalizar(p);
    return relNorm === pNorm || relNorm.startsWith(pNorm + '/');
  });
}

/**
 * Aplica un bloque BUSCAR/REEMPLAZAR. Primero busca coincidencia exacta; si no hay,
 * compara línea por línea ignorando espacios al inicio y al final. Devuelve null si no encaja.
 */
export function aplicarEdicion(
  contenido: string,
  buscar: string,
  reemplazar: string,
): string | null {
  if (!buscar.trim()) return null;
  const finDeLinea = contenido.includes('\r\n') ? '\r\n' : '\n';
  const c = contenido.replace(/\r\n/g, '\n');
  const b = buscar.replace(/\r\n/g, '\n');
  const r = reemplazar.replace(/\r\n/g, '\n');
  let resultado: string | null = null;

  // Buscar todas las coincidencias exactas
  const coincidenciasExactas: number[] = [];
  let posicion = c.indexOf(b);
  while (posicion >= 0) {
    coincidenciasExactas.push(posicion);
    posicion = c.indexOf(b, posicion + 1);
  }

  if (coincidenciasExactas.length > 1) {
    // Múltiples coincidencias exactas: ambigüedad
    return null;
  } else if (coincidenciasExactas.length === 1) {
    // Una sola coincidencia exacta
    resultado =
      c.slice(0, coincidenciasExactas[0]) + r + c.slice(coincidenciasExactas[0] + b.length);
  } else {
    // No hay coincidencia exacta, intentar coincidencia difusa
    const lineas = c.split('\n');
    const buscadas = b.split('\n');
    const coincidencias: number[] = [];
    for (let i = 0; i + buscadas.length <= lineas.length; i++) {
      let coincide = true;
      for (let j = 0; j < buscadas.length; j++) {
        if (lineas[i + j]!.trim() !== buscadas[j]!.trim()) {
          coincide = false;
          break;
        }
      }
      if (coincide) coincidencias.push(i);
    }
    // Si hay múltiples coincidencias difusas, reportar ambigüedad en lugar de elegir la primera
    if (coincidencias.length > 1) return null;
    if (coincidencias.length === 1) {
      resultado = [
        ...lineas.slice(0, coincidencias[0]),
        ...r.split('\n'),
        ...lineas.slice(coincidencias[0] + buscadas.length),
      ].join('\n');
    }
  }
  return resultado === null ? null : resultado.replace(/\n/g, finDeLinea);
}

function recorrer(
  carpeta: string,
  visitar: (absoluta: string, esCarpeta: boolean, nivel: number) => boolean | void,
  nivel = 0,
): void {
  let nombres: string[];
  try {
    nombres = readdirSync(carpeta).sort();
  } catch {
    return;
  }
  for (const nombre of nombres) {
    if (IGNORADOS.has(nombre)) continue;
    const absoluta = join(carpeta, nombre);
    let esCarpeta = false;
    try {
      esCarpeta = statSync(absoluta).isDirectory();
    } catch {
      continue;
    }
    if (visitar(absoluta, esCarpeta, nivel) === false) return;
    if (esCarpeta) recorrer(absoluta, visitar, nivel + 1);
  }
}

export function arbolDeArchivos(
  raiz: string,
  inicio = '.',
  maxNivel = 4,
  maxElementos = 400,
): string {
  const base = rutaSegura(raiz, inicio);
  if (!existsSync(base)) return '(la carpeta todavía no existe)';
  const lineas: string[] = [];
  recorrer(base, (absoluta, esCarpeta, nivel) => {
    if (lineas.length >= maxElementos) {
      lineas.push('… (lista recortada)');
      return false;
    }
    if (nivel > maxNivel) return;
    const nombre = absoluta.split(sep).pop() ?? '';
    lineas.push('  '.repeat(nivel) + nombre + (esCarpeta ? '/' : ''));
  });
  return lineas.length ? lineas.join('\n') : '(carpeta vacía)';
}

function buscarEnArchivos(
  raiz: string,
  inicio: string,
  patron: string,
): { texto: string; total: number } {
  // Validar el patrón antes de compilarlo para evitar ReDoS
  if (esRegexPeligroso(patron)) {
    return {
      texto: 'Patrón de búsqueda demasiado complejo o peligroso. Usa una búsqueda más simple.',
      total: 0,
    };
  }
  let expresion: RegExp;
  try {
    expresion = new RegExp(patron, 'i');
  } catch {
    expresion = new RegExp(patron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const hallazgos: string[] = [];
  recorrer(rutaSegura(raiz, inicio), (absoluta, esCarpeta) => {
    if (esCarpeta || BINARIOS.test(absoluta) || hallazgos.length >= 60) return;
    if (statSync(absoluta).size > 1_000_000) return;
    readFileSync(absoluta, 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        if (hallazgos.length < 60 && expresion.test(linea)) {
          hallazgos.push(`${rutaRelativa(raiz, absoluta)}:${i + 1}: ${linea.trim().slice(0, 200)}`);
        }
      });
  });
  return {
    texto: hallazgos.length ? hallazgos.join('\n') : 'Sin coincidencias.',
    total: hallazgos.length,
  };
}

/** Ejecuta un comando de terminal sin bloquear la interfaz. */
export function ejecutarComando(
  comando: string,
  carpeta: string,
  op: { limiteMs?: number; senal?: AbortSignal } = {},
): Promise<ResultadoHerramienta> {
  const limite = op.limiteMs ?? 180000;
  const esWindows = process.platform === 'win32';
  return new Promise((resolver) => {
    const hijo = spawn(esWindows ? `chcp 65001>nul & ${comando}` : comando, {
      shell: true,
      cwd: carpeta,
      windowsHide: true,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    let salida = '';
    const agregar = (datos: Buffer): void => {
      if (salida.length < MAX_SALIDA_COMANDO) salida += datos.toString('utf8');
    };
    hijo.stdout?.on('data', agregar);
    hijo.stderr?.on('data', agregar);
    let motivo = '';
    const detener = (razon: string): void => {
      motivo = razon;
      if (hijo.pid === undefined) return;
      if (esWindows)
        spawnSync('taskkill', ['/pid', String(hijo.pid), '/t', '/f'], { windowsHide: true });
      else hijo.kill('SIGKILL');
    };
    const reloj = setTimeout(
      () => detener(`se detuvo después de ${Math.round(limite / 1000)} s`),
      limite,
    );
    const alAbortar = (): void => detener('interrumpido por el usuario');
    op.senal?.addEventListener('abort', alAbortar, { once: true });
    let terminado = false;
    const finalizar = (codigo: number | null, error?: Error): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      op.senal?.removeEventListener('abort', alAbortar);
      const texto = salida.trim() || '(sin salida)';
      const estado = error ? `error: ${error.message}` : motivo || `código de salida ${codigo}`;
      const ok = !error && !motivo && codigo === 0;
      const ultimas = texto.split('\n').slice(-4).join('\n');
      resolver({
        ok,
        salida: `[${estado}]\n${recortar(texto)}`,
        resumen: `${ok ? 'Terminó bien' : 'Falló'} (${estado})\n${ultimas}`,
      });
    };
    hijo.on('error', (e) => finalizar(null, e));
    hijo.on('close', (codigo) => finalizar(codigo));
  });
}

function lineasDeDiferencia(signo: '+' | '-', texto: string): LineaDiferencia[] {
  return texto.split('\n').map((t) => ({ signo, texto: t }));
}

const BLOQUEADO_EN_PLANEACION =
  'Estás en la fase de planeación: todavía no puedes modificar archivos ni ejecutar comandos. Presenta tu plan con la acción plan.';

export async function ejecutarAccion(
  accion: Accion,
  ctx: ContextoHerramientas,
  senal?: AbortSignal,
): Promise<ResultadoHerramienta> {
  try {
    switch (accion.tipo) {
      case 'leer': {
        const absoluta = rutaSegura(ctx.raiz, accion.ruta);
        if (!existsSync(absoluta))
          return { ok: false, salida: `No existe: ${accion.ruta}`, resumen: 'No existe' };
        if (statSync(absoluta).isDirectory()) {
          const arbol = arbolDeArchivos(ctx.raiz, accion.ruta);
          return { ok: true, salida: arbol, resumen: `${arbol.split('\n').length} elementos` };
        }
        const contenido = readFileSync(absoluta, 'utf8');
        return {
          ok: true,
          salida: recortar(contenido, 20000),
          resumen: `Leí ${contenido.split('\n').length} líneas`,
        };
      }
      case 'listar': {
        const arbol = arbolDeArchivos(ctx.raiz, accion.ruta);
        return { ok: true, salida: arbol, resumen: `${arbol.split('\n').length} elementos` };
      }
      case 'buscar': {
        const r = buscarEnArchivos(ctx.raiz, accion.ruta, accion.patron);
        return {
          ok: true,
          salida: r.texto,
          resumen: `${r.total} coincidencia${r.total === 1 ? '' : 's'}`,
        };
      }
      case 'escribir': {
        if (ctx.soloLectura)
          return {
            ok: false,
            salida: BLOQUEADO_EN_PLANEACION,
            resumen: 'Bloqueado en la planeación',
          };
        const absoluta = rutaSegura(ctx.raiz, accion.ruta);
        if (esProtegida(ctx, absoluta))
          return {
            ok: false,
            salida: `Archivo protegido, no se puede modificar: ${accion.ruta}`,
            resumen: 'Archivo protegido',
          };
        const existia = existsSync(absoluta);
        mkdirSync(dirname(absoluta), { recursive: true });
        writeFileSync(absoluta, accion.contenido);
        ctx.cambiados.add(rutaRelativa(ctx.raiz, absoluta));
        const lineas = accion.contenido.split('\n').length;
        return {
          ok: true,
          salida: `Escrito ${accion.ruta} (${lineas} líneas).`,
          resumen: `${existia ? 'Reescribí' : 'Creé'} ${lineas} líneas`,
          diferencias: lineasDeDiferencia('+', accion.contenido.trimEnd()).slice(0, 10),
        };
      }
      case 'editar': {
        if (ctx.soloLectura)
          return {
            ok: false,
            salida: BLOQUEADO_EN_PLANEACION,
            resumen: 'Bloqueado en la planeación',
          };
        const absoluta = rutaSegura(ctx.raiz, accion.ruta);
        if (esProtegida(ctx, absoluta))
          return {
            ok: false,
            salida: `Archivo protegido, no se puede modificar: ${accion.ruta}`,
            resumen: 'Archivo protegido',
          };
        if (!existsSync(absoluta))
          return {
            ok: false,
            salida: `No existe: ${accion.ruta}. Usa escribir para crearlo.`,
            resumen: 'No existe',
          };
        if (accion.bloques.length === 0) {
          return {
            ok: false,
            salida: 'La acción editar no tiene bloques BUSCAR/REEMPLAZAR válidos.',
            resumen: 'Edición mal formada',
          };
        }
        let contenido = readFileSync(absoluta, 'utf8');
        const fallidos: number[] = [];
        accion.bloques.forEach((b, i) => {
          const nuevo = aplicarEdicion(contenido, b.buscar, b.reemplazar);
          if (nuevo === null) fallidos.push(i + 1);
          else contenido = nuevo;
        });
        if (fallidos.length) {
          return {
            ok: false,
            salida: `Los bloques ${fallidos.join(', ')} no coinciden con el contenido actual de ${accion.ruta}. Vuelve a leer el archivo y copia las líneas exactas. No se aplicó ningún cambio.`,
            resumen: 'El texto a reemplazar no coincide',
          };
        }
        writeFileSync(absoluta, contenido);
        ctx.cambiados.add(rutaRelativa(ctx.raiz, absoluta));
        const diferencias = accion.bloques.flatMap((b) => [
          ...lineasDeDiferencia('-', b.buscar),
          ...lineasDeDiferencia('+', b.reemplazar),
        ]);
        const agregadas = diferencias.filter((d) => d.signo === '+').length;
        const quitadas = diferencias.length - agregadas;
        return {
          ok: true,
          salida: `Editado ${accion.ruta} (${accion.bloques.length} bloque(s)).`,
          resumen: `${agregadas} línea${agregadas === 1 ? '' : 's'} agregada${agregadas === 1 ? '' : 's'}, ${quitadas} quitada${quitadas === 1 ? '' : 's'}`,
          diferencias: diferencias.slice(0, MAX_DIFERENCIAS),
        };
      }
      case 'ejecutar': {
        if (ctx.soloLectura)
          return {
            ok: false,
            salida: BLOQUEADO_EN_PLANEACION,
            resumen: 'Bloqueado en la planeación',
          };
        // Bloquear comandos peligrosos incluso con autoAprobar activado
        if (esComandoPeligroso(accion.comando)) {
          return {
            ok: false,
            salida:
              'Este comando parece peligroso y requiere aprobación explícita incluso con autoAprobar activado.',
            resumen: 'Comando peligroso bloqueado',
          };
        }
        if (!ctx.autoAprobar) {
          const opciones = ctx.permitirSiempre
            ? ['Sí', 'Sí, y no volver a preguntar en esta sesión', 'No']
            : ['Sí', 'No'];
          const eleccion = await ctx.ui.elegir('¿Ejecuto este comando?', opciones, accion.comando);
          if (eleccion < 0 || opciones[eleccion] === 'No') {
            return {
              ok: false,
              salida:
                'El usuario no autorizó este comando. Pregúntale qué prefiere o resuélvelo de otra forma.',
              resumen: 'No autorizado',
            };
          }
          if (ctx.permitirSiempre && eleccion === 1) ctx.autoAprobar = true;
        }
        mkdirSync(ctx.raiz, { recursive: true });
        return ejecutarComando(accion.comando, ctx.raiz, { senal });
      }
      case 'equipo': {
        const inventario = ctx.equipo();
        if (!inventario)
          return {
            ok: false,
            salida: 'Todavía no tengo el inventario del equipo.',
            resumen: 'Sin inventario',
          };
        const r = buscarEnEquipo(inventario, accion.buscar);
        return {
          ok: true,
          salida: r.texto,
          resumen: `${r.total} resultado${r.total === 1 ? '' : 's'}`,
        };
      }
      default:
        return { ok: true, salida: '', resumen: '' };
    }
  } catch (e) {
    const mensaje = (e as Error).message;
    return { ok: false, salida: mensaje, resumen: mensaje };
  }
}
