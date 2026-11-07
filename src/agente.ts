import type { Config } from './config';
import { ejecutarAccion, type ContextoHerramientas } from './herramientas';
import { revisarIdioma } from './idioma';
import { ejemploDeTrabajo } from './indicaciones';
import type { PasoPlan } from './interfaz/tipos';
import { guardarExperiencia, recordar } from './memoria';
import { conversar, type Mensaje } from './ollama';
import { analizarAcciones, describirAccion, extraerTexto, huellaAcciones } from './protocolo';

export interface ResultadoAgente {
  terminado: boolean;
  resumen: string;
  plan: PasoPlan[];
}

export interface OpcionesEjecucion {
  senal?: AbortSignal;
  /** Detenerse en cuanto el modelo registre un plan (fase de planeación de las mejoras). */
  pararEnPlan?: boolean;
}

const RESULTADOS_VIEJOS = '[resultados antiguos omitidos para ahorrar memoria]';
const CUERPO_ACCION =
  /(<(?:escribir|write|editar|edit)\s+(?:ruta|path)=["'][^"']*["']\s*>?)[\s\S]*?(<\/(?:escribir|write|editar|edit)>)/g;
const MAX_TEXTO_SIN_ACCION = 1500;
/** Vueltas sin progreso que se comparan: así también se ven los bucles que alternan dos acciones. */
const VENTANA_HUELLAS = 6;
const REPETICIONES_PARA_ATASCO = 3;

/** De los resultados viejos conserva qué se hizo y si falló, y descarta el cuerpo. */
function resumirResultados(contenido: string): string {
  const encabezados = contenido
    .split('\n')
    .filter((linea) => linea.startsWith('### '))
    .map((linea) => (linea.length > 120 ? `${linea.slice(0, 120)}…` : linea));
  return encabezados.length
    ? `RESULTADOS (resumen de lo ya hecho):\n\n${encabezados.join('\n')}\n[cuerpo omitido para ahorrar memoria]`
    : RESULTADOS_VIEJOS;
}

/** Agente que conversa con el modelo y ejecuta sus acciones en bucle, con controles contra la divagación. */
export class Agente {
  readonly mensajes: Mensaje[];
  plan: PasoPlan[] = [];
  private readonly inicio: number;

  constructor(
    private readonly cfg: Config,
    indicaciones: string,
    readonly ctx: ContextoHerramientas,
    private readonly modo: 'tarea' | 'mejora',
  ) {
    this.mensajes = [{ role: 'system', content: indicaciones }, ...ejemploDeTrabajo()];
    this.inicio = this.mensajes.length;
  }

  async ejecutar(mensajeUsuario: string, op: OpcionesEjecucion = {}): Promise<ResultadoAgente> {
    const { senal } = op;
    const ui = this.ctx.ui;
    this.mensajes.push({ role: 'user', content: mensajeUsuario });
    let empujones = 0;
    let correccionesIdioma = 0;
    let atascos = 0;
    let reintentar = false;
    const huellas: string[] = [];

    for (let paso = 1; paso <= this.cfg.maxPasos; paso++) {
      if (senal?.aborted) return this.interrumpido();
      this.podar();
      this.informarContexto();

      ui.emitir({ tipo: 'pensando', activo: true, etiqueta: paso === 1 ? 'Pensando' : 'Trabajando' });
      let respuesta: string;
      try {
        respuesta = await conversar(this.cfg, this.mensajes, {
          senal,
          // Con la misma temperatura el modelo vuelve a elegir la salida que ya falló.
          temperatura: reintentar ? Math.min(0.9, this.cfg.temperatura + 0.3) : this.cfg.temperatura,
          alToken: (_f, total) => {
            if (total % 8 === 0) ui.emitir({ tipo: 'progreso', tokens: total });
          },
        });
      } finally {
        ui.emitir({ tipo: 'pensando', activo: false });
      }
      this.mensajes.push({ role: 'assistant', content: respuesta });
      reintentar = false;

      const acciones = analizarAcciones(respuesta);
      const texto = extraerTexto(respuesta);
      const idioma = revisarIdioma(texto);

      // Respuesta sin acciones: es la respuesta final al usuario (o un error de formato).
      if (acciones.length === 0) {
        if (!idioma.ok && correccionesIdioma < 2) {
          correccionesIdioma++;
          reintentar = true;
          this.mensajes.push({
            role: 'user',
            content: `Tu respuesta no cumple la regla de idioma: ${idioma.motivo}. Reescríbela completa, solo en español latinoamericano.`,
          });
          continue;
        }
        if (this.ctx.requiereTerminar && empujones < 2) {
          empujones++;
          reintentar = true;
          if (texto) ui.emitir({ tipo: 'info', texto });
          this.mensajes.push({
            role: 'user',
            content:
              texto.length > MAX_TEXTO_SIN_ACCION
                ? 'Escribiste demasiado texto sin usar acciones. Sé breve y continúa trabajando con las acciones del protocolo.'
                : 'No usaste ninguna acción. Continúa trabajando con las acciones del protocolo o, si ya terminaste, usa terminar con un resumen.',
          });
          continue;
        }
        if (texto) ui.emitir({ tipo: 'asistente', texto });
        return { terminado: true, resumen: texto, plan: this.plan };
      }

      // En un turno con acciones el texto es narración del trabajo, no una respuesta al usuario:
      // se muestra como nota para no llenar la pantalla de burbujas casi idénticas.
      if (texto) ui.emitir({ tipo: 'info', texto });

      const resultados: string[] = [];
      let todoBien = true;
      let resumenFinal: string | null = null;
      let planNuevo = false;
      let progreso = false;

      for (const accion of acciones) {
        if (senal?.aborted) return this.interrumpido();
        if (accion.tipo === 'terminar') {
          resumenFinal = accion.resumen;
          break;
        }
        if (accion.tipo === 'plan') {
          this.plan = accion.pasos.map((t) => ({ texto: t, hecho: false }));
          ui.emitir({ tipo: 'plan', pasos: this.plan });
          resultados.push(`### Plan → bien\nPlan registrado con ${this.plan.length} pasos.`);
          planNuevo = true;
          continue;
        }
        if (accion.tipo === 'hecho') {
          const p = this.plan[accion.paso - 1];
          if (p) {
            p.hecho = true;
            ui.emitir({ tipo: 'plan', pasos: this.plan });
          }
          // Sin esta línea el turno devuelve «(sin resultados)» y el modelo vuelve a marcar lo mismo.
          const faltantes = this.plan.filter((paso) => !paso.hecho).length;
          resultados.push(
            `### Hecho(paso ${accion.paso}) → ${p ? 'bien' : 'ERROR'}\n` +
              (p ? `Quedan ${faltantes} pasos sin terminar.` : `El plan no tiene un paso ${accion.paso}.`),
          );
          continue;
        }
        if (accion.tipo === 'preguntar') {
          ui.emitir({ tipo: 'asistente', texto: accion.pregunta });
          const respuestaUsuario = await ui.leer('Tu respuesta');
          resultados.push(`### Pregunta → respuesta del usuario\n${respuestaUsuario ?? '(el usuario no respondió)'}`);
          continue;
        }
        if (accion.tipo === 'recordar') {
          recordar(accion.dato);
          ui.emitir({ tipo: 'info', texto: `Lo recordaré: ${accion.dato}` });
          resultados.push('### Recordar → bien\nDato guardado en tu memoria permanente.');
          continue;
        }
        const d = describirAccion(accion);
        ui.emitir({ tipo: 'accion', nombre: d.nombre, detalle: d.detalle });
        const r = await ejecutarAccion(accion, this.ctx, senal);
        ui.emitir({ tipo: 'resultado', ok: r.ok, resumen: r.resumen, diferencias: r.diferencias });
        if (!r.ok) todoBien = false;
        else if (accion.tipo === 'escribir' || accion.tipo === 'editar') progreso = true;
        resultados.push(`### ${d.nombre}(${d.detalle}) → ${r.ok ? 'bien' : 'ERROR'}\n${r.salida}`);
      }

      if (op.pararEnPlan && planNuevo) {
        if (resultados.length) this.mensajes.push({ role: 'user', content: `RESULTADOS:\n\n${resultados.join('\n\n')}` });
        return { terminado: true, resumen: texto, plan: this.plan };
      }

      if (resumenFinal !== null && todoBien) {
        for (const p of this.plan) p.hecho = true;
        if (resumenFinal) ui.emitir({ tipo: 'asistente', texto: resumenFinal });
        if (this.plan.length) ui.emitir({ tipo: 'plan', pasos: this.plan, fijo: true });
        const plan = this.plan;
        this.plan = [];
        guardarExperiencia(this.modo, [this.mensajes[0]!, ...this.mensajes.slice(this.inicio)]);
        return { terminado: true, resumen: resumenFinal, plan };
      }

      // Detección de bucles con los resultados ya en la mano: solo cuentan las vueltas que
      // no cambiaron nada, y se comparan dentro de una ventana para ver también los ciclos
      // que alternan dos acciones (leer → editar fallido → leer…).
      const huella = huellaAcciones(acciones);
      if (progreso || planNuevo) huellas.length = 0;
      else {
        huellas.push(huella);
        if (huellas.length > VENTANA_HUELLAS) huellas.shift();
      }
      const atasco =
        !progreso && !planNuevo && huellas.filter((h) => h === huella).length >= REPETICIONES_PARA_ATASCO;
      if (atasco) {
        atascos++;
        huellas.length = 0;
        if (atascos >= 3) {
          return { terminado: false, resumen: 'Me quedé repitiendo lo mismo sin avanzar. Dime cómo prefieres que lo resuelva.', plan: this.plan };
        }
        reintentar = true;
        ui.emitir({ tipo: 'aviso', texto: 'Detecté que estaba repitiendo lo mismo; cambio de estrategia.' });
      }

      let notas = '';
      if (!idioma.ok) notas += `\nRecuerda: escribe solo en español latinoamericano (${idioma.motivo}).`;
      if (texto.length > MAX_TEXTO_SIN_ACCION) notas += '\nSé más breve: una o dos frases antes de las acciones.';
      if (resumenFinal !== null && !todoBien) notas += '\nTodavía no puedes terminar: hay errores sin resolver.';
      const indicacion = atasco
        ? 'ALTO: llevas varias vueltas con las mismas acciones y ningún cambio. Di en una frase por qué no funciona y toma otro camino: otra herramienta, otro archivo o preguntar al usuario. No repitas la acción que ya falló.'
        : todoBien
          ? 'Continúa con el siguiente paso del plan. Cuando todo esté hecho y verificado, usa terminar.'
          : 'Hubo errores: lee el mensaje de error con atención, encuentra la causa y corrígela antes de seguir.';
      if (!todoBien) reintentar = true;
      // Los RESULTADOS se entregan siempre, también en el turno atascado: sin el error a la
      // vista el modelo no recibe ninguna información nueva con la que cambiar de estrategia.
      this.mensajes.push({
        role: 'user',
        content: `RESULTADOS:\n\n${resultados.join('\n\n') || '(sin resultados)'}\n\n${indicacion}${notas}`,
      });
    }
    return { terminado: false, resumen: 'Llegué al máximo de pasos sin terminar. Dime si continúo.', plan: this.plan };
  }

  private interrumpido(): ResultadoAgente {
    return { terminado: false, resumen: 'Interrumpido.', plan: this.plan };
  }

  private informarContexto(): void {
    const caracteres = this.mensajes.reduce((n, m) => n + m.content.length, 0);
    const porcentaje = Math.min(100, Math.round((caracteres / 3 / this.cfg.contexto) * 100));
    this.ctx.ui.emitir({ tipo: 'estado', contexto: porcentaje });
  }

  /** Recorta mensajes antiguos para que la conversación quepa en el contexto del modelo. */
  private podar(): void {
    const presupuesto = this.cfg.contexto * 3; // ~3 caracteres por token
    const tamano = (): number => this.mensajes.reduce((n, m) => n + m.content.length, 0);
    const recientes = 4;
    for (let i = this.inicio + 1; i < this.mensajes.length - recientes && tamano() > presupuesto; i++) {
      const m = this.mensajes[i]!;
      if (m.role === 'user' && m.content.startsWith('RESULTADOS:')) m.content = resumirResultados(m.content);
      else if (m.role === 'assistant')
        m.content = m.content.replace(CUERPO_ACCION, '$1\n[cuerpo omitido para ahorrar memoria]\n$2');
    }
    // Si resumir no alcanza, se descartan los turnos más viejos. Nunca se deja que Ollama
    // recorte el inicio de la conversación: ahí van las indicaciones y el protocolo, y sin
    // ellos el modelo deja de escribir acciones válidas y se queda repitiendo texto.
    while (this.mensajes.length - recientes > this.inicio + 1 && tamano() > presupuesto) {
      this.mensajes.splice(this.inicio + 1, 1);
    }
  }

  /**
   * Limpia el contexto de correcciones anteriores para evitar que el historial acumulado
   * degrade la calidad de las siguientes correcciones. Mantiene el system prompt y el
   * ejemplo de trabajo, pero elimina los mensajes de intentos previos.
   */
  limpiarContextoCorrecciones(): void {
    // Mantener solo el system prompt (índice 0) y el ejemplo de trabajo (índices 1 a this.inicio-1)
    // Eliminar todo lo demás
    this.mensajes.length = this.inicio;
    this.plan = [];
  }
}
