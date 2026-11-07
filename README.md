# Nahual

![CI/CD Pipeline](https://github.com/SanCarlosHnos/nahual/actions/workflows/ci-cd.yml/badge.svg)
![Release](https://github.com/SanCarlosHnos/nahual/actions/workflows/release.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)

Asistente de programación **local con ventana gráfica** que habla español latinoamericano, construye software completo y **se mejora a sí mismo** de forma segura. Tiene un avatar animado que reacciona mientras trabaja. Usa modelos locales de Ollama; nada sale de tu computadora.

El nombre viene del nahual mesoamericano, el ser que se transforma: igual que él, Nahual evoluciona con cada petición tuya.

## Instalar

En PowerShell, dentro de esta carpeta:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

Necesitas **Node**, **git** y **Ollama** instalados. El instalador:
- copia Nahual a `%LOCALAPPDATA%\Programs\Nahual` (esta carpeta queda como la «fábrica»),
- crea el comando `nahual` y accesos directos en el menú Inicio y el escritorio,
- crea un modelo propio llamado `nahual` en Ollama a partir del modelo base.

Tus proyectos van a `Documentos\Nahual` y los ajustes a `%APPDATA%\Nahual`.

## Uso

Abre Nahual y escríbele con naturalidad, en español:

- **Construir**: «hazme una página web para mi taller mecánico con formulario de citas».
- **Mejorarse a sí mismo**: «quiero que puedas leer archivos PDF» o «que tus respuestas sean más cortas». Nahual te muestra un **plan**, tú lo apruebas, y solo entonces se modifica.
- Comandos útiles: `/ayuda`, `/equipo` (lo que sabe de tu computadora), `/historial` (cómo ha evolucionado), `/modelo`, `/deshacer`.

## Cómo trabaja (para no equivocarse ni divagar)

Sigue siempre el mismo método: entiende lo que pides, investiga los archivos, arma un plan, lo ejecuta paso por paso y verifica que funcione antes de decir que terminó. Tiene frenos para no divagar: detecta cuando se repite, evita el relleno, puede preguntarte si le falta un dato y recuerda tus preferencias. Un revisor comprueba que todo lo que te escribe esté en español latino.

## Por qué no puede dañarse solo

1. **Taller aislado**: cuando se mejora, trabaja sobre una copia. La versión que usas no se toca.
2. **Núcleo protegido**: el supervisor, el guardián y las pruebas no se pueden modificar; si una mejora lo intenta, se descarta entera.
3. **Pruebas que no puede cambiar**: además de compilar, se comprueba que la interfaz, las mejoras y las tareas sigan funcionando de verdad.
4. **Solo se aplica lo verificado**: si una mejora no pasa, se descarta y Nahual queda igual.
5. **Vuelta automática**: si una versión nueva no arranca, el supervisor vuelve solo a la última que funcionó.

Si algo va mal, estos comandos funcionan aunque la interfaz no abra:

```powershell
nahual --deshacer
```
```powershell
nahual --rescate
```

`--deshacer` revierte la última mejora; `--rescate` vuelve a la versión de fábrica.

## Desarrollo y CI/CD

El proyecto usa **GitHub Actions** para integración y despliegue continuo:

### Pipeline de CI/CD

Cada push y pull request a las ramas `master` o `main` ejecuta automáticamente:

1. **Tests en múltiples versiones de Node.js** (20.x, 22.x, 24.x)
2. **Verificación de compilación TypeScript** estricta
3. **Tests unitarios** con Vitest (76 tests)
4. **Code coverage** con mínimo 80% requerido
5. **Verificación completa** del sistema (autopruebas, interfaz, Electron)
6. **Análisis de calidad de código** con ESLint y Prettier

### Workflows

- **CI/CD Pipeline** (`ci-cd.yml`): Se ejecuta en cada push/PR
- **Release** (`release.yml`): Crea releases automáticos cuando se pushea un tag `v*.*.*`

### Tests locales

Antes de hacer push, verifica que todo funcione:

```bash
npm test                    # Tests unitarios
npm run test:coverage       # Tests con reporte de coverage
npm run verificar           # Verificación completa
npm run check               # Compilación TypeScript
npm run lint                # Análisis de calidad con ESLint
npm run lint:fix            # Corregir problemas de lint automáticamente
npm run format              # Formatear código con Prettier
npm run format:check        # Verificar que el código está formateado
```

### Calidad de código

El proyecto usa **ESLint** y **Prettier** para mantener la calidad y consistencia del código:

- **ESLint 10** con configuración flat (`eslint.config.js`)
- **Prettier 3.9** para formateo automático (`.prettierrc`)
- Integración completa: los problemas de formato se reportan como errores de lint
- Compatible con TypeScript 7.0 usando `@babel/eslint-parser`

La configuración de Prettier:
- Comillas simples, punto y coma, tabulación de 2 espacios
- Líneas de máximo 100 caracteres
- Comas al final (trailing commas)
- Final de línea Unix (LF)

El CI/CD verifica automáticamente que el código pase lint y format en cada push/PR.

### Code Coverage

El proyecto requiere un mínimo de **80% de cobertura** en:
- Líneas de código
- Funciones
- Ramas (branches)
- Sentencias (statements)

Los reportes de coverage se generan automáticamente en el CI/CD y están disponibles como artefactos descargables.

### Build local

Para compilar el ejecutable portable de Windows:

```bash
npm run build               # Genera dist/Nahual-Portable-{version}.exe
npm run build:installer     # Genera instalador NSIS (opcional)
```

Requisitos: Windows 10/11 x64, Node.js 20+. El build usa **electron-builder** y produce un `.exe` portable (~110 MB) que no requiere instalación.

### Crear un release

Para publicar una nueva versión:

```bash
git tag -a v0.8.0 -m "Descripción de la versión"
git push origin v0.8.0
```

El workflow de release (`release.yml`) automáticamente:

1. Ejecuta tests y verificación completa
2. Sincroniza la versión del tag en `package.json`
3. Compila el ejecutable portable con electron-builder
4. Crea el release en GitHub con el `.exe` adjunto
5. Hace commit a `master` con la versión actualizada (`[skip ci]`)

No es necesario actualizar `package.json` manualmente; el workflow lo sincroniza con el tag.

Los releases están en [github.com/SanCarlosHnos/nahual/releases](https://github.com/SanCarlosHnos/nahual/releases).

## Desinstalar

```powershell
powershell -ExecutionPolicy Bypass -File .\desinstalar.ps1
```

No borra tus proyectos ni tus ajustes.
