// Índice de herramientas como plugins
// Re-exporta todas las herramientas y provee una función para registrarlas en el ToolRegistry

export { toolLeer } from './leer';
export { toolListar } from './listar';
export { toolBuscar } from './buscar';
export { toolEscribir } from './escribir';
export { toolEditar } from './editar';
export { toolEjecutar } from './ejecutar';
export { toolEquipo } from './equipo';

import { ToolRegistry } from '../servicios/tool-registry';
import { toolLeer } from './leer';
import { toolListar } from './listar';
import { toolBuscar } from './buscar';
import { toolEscribir } from './escribir';
import { toolEditar } from './editar';
import { toolEjecutar } from './ejecutar';
import { toolEquipo } from './equipo';

/** Crea un ToolRegistry con todas las herramientas estándar registradas */
export function crearRegistryEstandar(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.registrar(toolLeer);
  registry.registrar(toolListar);
  registry.registrar(toolBuscar);
  registry.registrar(toolEscribir);
  registry.registrar(toolEditar);
  registry.registrar(toolEjecutar);
  registry.registrar(toolEquipo);

  return registry;
}
