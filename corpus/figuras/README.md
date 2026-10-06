# Corpus de figuras

Textos oficiales de figuras públicas para el ranking de Promesómetro. Reglas:

- El texto se ingiere **literal**, tal como aparece en la fuente. Nunca se redacta, resume ni parafrasea texto atribuido a una persona real.
- Todo archivo lleva `source`: la URL exacta de donde se extrajo. Sin fuente no se ingiere.
- `formato` es uno de: `discurso`, `rueda`, `declaracion`, `post`, `decreto`, `entrevista`, `sesion`.
- Si un fetch falla o no produce texto usable, la figura se queda sin ese texto. No se inventa nada para rellenar el hueco.
- Colombia (Gustavo Petro y Abelardo de la Espriella) se carga a mano: el sitio de la presidencia colombiana necesita JavaScript para renderizar el contenido y el `fetch` plano no lo obtiene. Usa `--file` con un `.txt` copiado manualmente desde la fuente, indicando siempre `--url` como `source`.

## Estructura

```
corpus/figuras/
├── figuras.json              # lista de figuras (id, nombre, cargo, país, idioma)
├── textos/
│   └── <figuraId>/
│       └── <YYYY-MM-DD>-<slug>.json   # TextoMeta + { text }
```

## Ingerir un texto

```sh
pnpm ingest -- --figura sanchez --url https://www.lamoncloa.gob.es/... --formato sesion
```

Opciones: `--formato`, `--fecha YYYY-MM-DD`, `--titulo "..."`, `--lang es|en`, `--pregunta "..."`, `--force` (sobrescribe), `--file ruta.txt` (bypasa el fetch, para cargas manuales).

El CLI extrae título, fecha y párrafos del HTML, descarta menús, scripts y pies de página, y escribe el JSON en `corpus/figuras/textos/<figura>/`.

## Límite conocido

La transcripción de la sesión de control al Gobierno (Moncloa) puede incluir intervenciones de otros diputados además del presidente, no sólo sus propias palabras. Se acepta para el sprint 1; queda pendiente separar hablantes.
