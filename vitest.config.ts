import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.config.ts',
        'electron/',
        'nucleo/',
        'src/autopruebas.ts',
        'src/equipo.ts',
        'src/herramientas.ts',
        'src/protocolo.ts',
        'src/idioma.ts',
        'src/intencion.ts',
        'src/indicaciones.ts',
        'src/config.ts',
        'src/memoria.ts',
        'src/modelo.ts',
        'src/ollama.ts',
        'src/mejorador.ts',
        'src/comandos.ts',
        'src/rutas.ts',
        'src/interfaz/**',
        'src/herramientas/buscar.ts',
        'src/herramientas/editar.ts',
        'src/herramientas/ejecutar.ts',
        'src/herramientas/equipo.ts',
        'src/herramientas/escribir.ts',
        'src/herramientas/leer.ts',
        'src/herramientas/listar.ts',
      ],
      thresholds: {
        'src/servicios/**': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.js', '.mjs'],
  },
});
