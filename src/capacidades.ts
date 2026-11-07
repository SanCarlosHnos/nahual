// Lee el catálogo de herramientas creativas del equipo (imagen, video, voz, 3D, IA),
// que se guarda en %APPDATA%\Nahual\herramientas-creativas.md. Así Nahual sabe qué
// tiene instalado y cómo usarlo. El archivo lo mantiene el usuario (o el propio Nahual).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_DATOS } from './rutas';

const ARCHIVO = join(DIR_DATOS, 'herramientas-creativas.md');

export function leerCapacidadesCreativas(): string {
  if (!existsSync(ARCHIVO)) return '';
  try {
    return readFileSync(ARCHIVO, 'utf8').replace(/^﻿/, '').trim();
  } catch {
    return '';
  }
}
