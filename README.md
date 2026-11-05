# Nahual

Asistente de programación **local** de terminal que habla español latinoamericano, construye software completo y **se mejora a sí mismo** de forma segura. Usa modelos locales de Ollama; nada sale de tu computadora.

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

## Desinstalar

```powershell
powershell -ExecutionPolicy Bypass -File .\desinstalar.ps1
```

No borra tus proyectos ni tus ajustes.
