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
const CUERPO_ESCRIBIR = /(<(?:escribir|write)\s+(?:ruta|path)=["'][^"']*["']\s*>)[\s\S]*?(<\/(?:escribir|write)>)/g;
const MAX_TEXTO_SIN_ACCION = 1500;

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
          alToken: (_f, total) => {
            if (total % 8 === 0) ui.emitir({ tipo: 'progreso', tokens: total });
          },
        });
      } finally {
        ui.emitir({ tipo: 'pensando', activo: false });
      }
      this.mensajes.push({ role: 'assistant', content: respuesta });

      const acciones = analizarAcciones(respuesta);
      const texto = extraerTexto(respuesta);
      const idioma = revisarIdioma(texto);

      // Respuesta sin acciones: es la respuesta final al usuario (o un error de formato).
      if (acciones.length === 0) {
        if (!idioma.ok && correccionesIdioma < 2) {
          correccionesIdioma++;
          this.mensajes.push({
            role: 'user',
            content: `Tu respuesta no cumple la regla de idioma: ${idioma.motivo}. Reescríbela completa, solo en español latinoamericano.`,
          });
          continue;
        }
        if (this.ctx.requiereTerminar && empujones < 2) {
          empujones++;
          if (texto) ui.emitir({ tipo: 'asistente', texto });
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

      if (texto) ui.emitir({ tipo: 'asistente', texto });

      // Detección de bucles: las mismas acciones tres veces seguidas.
      const huella = huellaAcciones(acciones);
      if (huella) {
        huellas.push(huella);
        const ultimas = huellas.slice(-3);
        if (ultimas.length === 3 && ultimas.every((h) => h === huella)) {
          atascos++;
          huellas.length = 0;
          if (atascos >= 3) {
            return { terminado: false, resumen: 'Me quedé repitiendo lo mismo sin avanzar. Dime cómo prefieres que lo resuelva.', plan: this.plan };
          }
          ui.emitir({ tipo: 'aviso', texto: 'Detecté que estaba repitiendo lo mismo; cambio de estrategia.' });
          this.mensajes.push({
            role: 'user',
            content:
              'ALTO: estás repitiendo exactamente las mismas acciones sin avanzar. Analiza por qué no funciona y cambia de estrategia, o usa preguntar si necesitas ayuda del usuario.',
          });
          continue;
        }
      }

      const resultados: string[] = [];
      let todoBien = true;
      let resumenFinal: string | null = null;
      let planNuevo = false;

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

      let notas = '';
      if (!idioma.ok) notas += `\nRecuerda: escribe solo en español latinoamericano (${idioma.motivo}).`;
      if (texto.length > MAX_TEXTO_SIN_ACCION) notas += '\nSé más breve: una o dos frases antes de las acciones.';
      if (resumenFinal !== null && !todoBien) notas += '\nTodavía no puedes terminar: hay errores sin resolver.';
      const indicacion = todoBien
        ? 'Continúa con el siguiente paso del plan. Cuando todo esté hecho y verificado, usa terminar.'
        : 'Hubo errores: lee el mensaje de error con atención, encuentra la causa y corrígela antes de seguir.';
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
      if (m.role === 'user' && m.content.startsWith('RESULTADOS:')) m.content = RESULTADOS_VIEJOS;
      else if (m.role === 'assistant') m.content = m.content.replace(CUERPO_ESCRIBIR, '$1\n[contenido ya guardado en el disco]\n$2');
    }
  }
}
