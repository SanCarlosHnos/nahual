import { mkdirSync } from 'node:fs';
import { Agente } from './agente';
import { buscarComando, sugerencias, type Estado } from './comandos';
import { cargarConfig } from './config';
import { cargarEquipo, equipoVigente, recolectarEquipo, resumenEquipo } from './equipo';
import { crearInterfaz } from './interfaz/index';
import type { Interfaz } from './interfaz/tipos';
import { indicacionesDeTareas } from './indicaciones';
import { clasificarIntencion } from './intencion';
import { leerMemoria } from './memoria';
import { leerCapacidadesCreativas } from './capacidades';
import { listarModelos, modeloInstalado } from './ollama';
import { carpetaTrabajoInicial, VERSION } from './rutas';

const CODIGO_REINICIO = 42;
const CODIGO_MEJORA = 43;

async function main(): Promise<void> {
  const cfg = cargarConfig();

  // Modo de comprobación usado por la verificación de mejoras: carga todo y sale.
  if (process.argv.includes('--check')) {
    indicacionesDeTareas(carpetaTrabajoInicial(cfg.carpetaProyectos), { equipo: '', memoria: '' });
    sugerencias();
    console.log('check ok');
    return;
  }

  const ui: Interfaz = await crearInterfaz(sugerencias());
  const estado: Estado = {
    cfg,
    carpeta: carpetaTrabajoInicial(cfg.carpetaProyectos),
    agente: null,
    equipo: cargarEquipo(),
    ui,
  };
  mkdirSync(estado.carpeta, { recursive: true });

  let controlador: AbortController | null = null;
  ui.alInterrumpir(() => {
    if (controlador) controlador.abort();
    else {
      ui.cerrar();
      process.exit(0);
    }
  });

  ui.emitir({
    tipo: 'bienvenida',
    titulo: 'Nahual',
    version: VERSION,
    modelo: cfg.modelo,
    carpeta: estado.carpeta,
    consejos: [
      'Pídeme lo que necesites en español, con naturalidad.',
      'Puedo construir programas y también mejorarme a mí mismo.',
      '/ayuda para ver todo lo que puedo hacer.',
    ],
  });
  ui.emitir({ tipo: 'estado', modelo: cfg.modelo, carpeta: estado.carpeta, contexto: 0 });

  // Comprueba Ollama y el modelo; actualiza el inventario del equipo en segundo plano.
  let modelos: string[] = [];
  try {
    modelos = await listarModelos(cfg);
    if (!modeloInstalado(modelos, cfg.modelo)) {
      ui.emitir({
        tipo: 'aviso',
        texto: `El modelo «${cfg.modelo}» no está instalado. Instálalo con «ollama pull ${cfg.modeloBase}» o elige otro con /modelo.`,
      });
    }
  } catch {
    ui.emitir({
      tipo: 'aviso',
      texto: `No pude contactar con Ollama en ${cfg.urlOllama}. Ábrelo antes de pedirme algo.`,
    });
  }
  if (!equipoVigente(estado.equipo)) {
    recolectarEquipo()
      .then((inv) => {
        if (inv) estado.equipo = inv;
      })
      .catch(() => {});
  }

  for (;;) {
    const entrada = await ui.leer();
    if (entrada === null) break;
    const linea = entrada.trim();
    if (!linea) continue;

    controlador = new AbortController();
    try {
      if (linea.startsWith('/')) {
        const [nombre = '', ...resto] = linea.slice(1).split(' ');
        const comando = buscarComando(nombre.toLowerCase());
        if (!comando) {
          ui.emitir({ tipo: 'aviso', texto: `No conozco el comando /${nombre}. Escribe /ayuda.` });
          continue;
        }
        const resultado = await comando.ejecutar({
          estado,
          argumentos: resto.join(' ').trim(),
          senal: controlador.signal,
        });
        if (resultado === 'salir') break;
        if (resultado === 'reiniciar' || resultado === 'mejorar') {
          ui.cerrar();
          process.exit(resultado === 'reiniciar' ? CODIGO_REINICIO : CODIGO_MEJORA);
        }
        continue;
      }

      const intencion = await clasificarIntencion(cfg, linea, controlador.signal);
      if (intencion === 'mejora') {
        const comando = buscarComando('mejorar')!;
        ui.emitir({
          tipo: 'info',
          texto:
            'Entiendo que quieres que me mejore a mí mismo. Prepararé un plan para que lo apruebes.',
        });
        const resultado = await comando.ejecutar({
          estado,
          argumentos: linea,
          senal: controlador.signal,
        });
        if (resultado === 'mejorar') {
          ui.cerrar();
          process.exit(CODIGO_MEJORA);
        }
        continue;
      }

      if (!estado.agente) {
        const contexto = {
          equipo: resumenEquipo(estado.equipo, modelos),
          memoria: leerMemoria(),
          creativas: leerCapacidadesCreativas(),
        };
        estado.agente = new Agente(
          cfg,
          indicacionesDeTareas(estado.carpeta, contexto),
          crearContextoTarea(estado),
          'tarea',
        );
      }
      estado.agente.ctx.autoAprobar = cfg.autoAprobar;
      const resultado = await estado.agente.ejecutar(linea, { senal: controlador.signal });
      if (!resultado.terminado && resultado.resumen)
        ui.emitir({ tipo: 'aviso', texto: resultado.resumen });
    } catch (e) {
      if (controlador.signal.aborted) ui.emitir({ tipo: 'aviso', texto: 'Interrumpido.' });
      else ui.emitir({ tipo: 'error', texto: (e as Error).message });
    } finally {
      controlador = null;
      ui.emitir({ tipo: 'pensando', activo: false });
    }
  }
  ui.cerrar();
}

function crearContextoTarea(estado: Estado) {
  return {
    raiz: estado.carpeta,
    protegidos: ['.git'],
    ui: estado.ui,
    autoAprobar: estado.cfg.autoAprobar,
    permitirSiempre: true,
    soloLectura: false,
    cambiados: new Set<string>(),
    requiereTerminar: false,
    equipo: () => estado.equipo,
  };
}

main().catch((e) => {
  console.error((e as Error).stack ?? String(e));
  process.exit(1);
});
