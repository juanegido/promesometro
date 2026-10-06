# Promesómetro

**No mide verdad. Mide compromiso.**

Acta de concreción del discurso político. Pega un programa, un discurso o una declaración y cada frase recibe un nivel de concreción de 0 a 4, un tipo (compromiso, diagnóstico, valores, ataque, relleno), un tema, una probabilidad de ser verificable en cuatro años y un tono. El acta agrega todo, extrae los compromisos medibles y genera una tarjeta para compartir.

El juez es [Jev](https://typesafe.ai), el modelo System One de TypeSafe AI: responde preguntas cerradas con probabilidades en una pasada, sin generar texto, en menos de un segundo. Un mismo texto obtiene el mismo veredicto. El juez no sabe quién habla: sólo ve la frase y el título.

Sin clave de TypeSafe, la plataforma usa un motor heurístico en español (reglas léxicas públicas en `packages/rhetoric/src/heuristic.ts`) y lo dice en pantalla.

## Estructura

| Paquete | Qué hace |
| --- | --- |
| `packages/decide` | Capa fina sobre `@typesafe-ai/sdk`: umbrales de confianza, escalado a LLM, `FakeDecider` para tests. |
| `packages/rhetoric` | La rúbrica (preguntas Jev), el segmentador, la agregación y el motor heurístico de respaldo. |
| `packages/capability-router` | Enrutado de preguntas a capabilities de Atida Data Foundation con Jev (proyecto hermano). |
| `apps/api` | API Hono en Node: análisis, comparación antes/después, corpus, caché por hash, rate limit. Sirve la web compilada. |
| `apps/web` | Vite + Preact. Vistas: Ranking, Analizar, Antes y después, Corpus, Método, Figura, Texto, Frase. Tarjeta PNG en canvas y tarjetas OG en servidor. |
| `corpus/` | Textos públicos con fuente obligatoria. Ver `corpus/README.md`. |
| `corpus/figuras/` | Textos de figuras públicas para el ranking. Ver `corpus/figuras/README.md`. |

## Arrancar

```sh
pnpm install
pnpm build
cp .env.example .env        # opcional: TYPESAFE_API_KEY para usar Jev (.env o .env.local)
pnpm start                   # http://localhost:8787 · carga .env y .env.local si existen
```

Desarrollo con recarga:

```sh
pnpm dev:api                 # API en :8787
pnpm dev:web                 # Vite en :5173 con proxy a /api
```

## API

| Método | Ruta | Cuerpo | Devuelve |
| --- | --- | --- | --- |
| POST | `/api/analyze` | `{ text, title?, source? }` | `DocumentVerdict` |
| GET | `/api/verdict/:hash` | | acta cacheada |
| POST | `/api/compare` | `{ antes, despues }` | `CompareVerdict` |
| GET | `/api/corpus` | | lista con metadatos |
| GET | `/api/corpus/:id` | | `{ entry, verdict }` |
| GET | `/api/method` | | la rúbrica completa |

Límites: 40.000 caracteres y 160 frases por acta. Rate limit por IP medido en frases juzgadas.

## Ranking de figuras

Un ranking de figuras públicas (jefes de Estado, líderes políticos) sobre una ventana móvil de 30 días de textos oficiales con fuente. Cada figura acumula métricas sobre todos sus textos juzgados: `humo` (frases sin relleno que se quedan en nivel 0-1), `medibles` (compromisos en nivel 3-4) y `ataques` (frases que descalifican a un adversario). Las definiciones exactas están en la página Método (`/metodo`, sirve `METRICAS` desde `/api/method`).

### Rutas

| Método | Ruta | Devuelve |
| --- | --- | --- |
| GET | `/api/figuras` | ranking con métricas y variación de la ventana anterior |
| GET | `/api/figuras/:id` | detalle de una figura y sus textos |
| GET | `/api/textos/:id` | un texto con su acta completa |
| GET | `/api/humo` | las tres frases destacadas del día más reciente |
| GET | `/og/frase/:textoId/:n.png` `/og/figura/:id.png` `/og/texto/:id.png` | tarjetas PNG 1200×630 para compartir |

Las páginas `/`, `/figura/:id`, `/texto/:id`, `/frase/:textoId/:n` y `/acta/:hash` llevan metaetiquetas Open Graph/Twitter inyectadas en el servidor cuando la web está compilada.

### Ingerir un texto

```sh
pnpm ingest -- --figura sanchez --url https://www.lamoncloa.gob.es/... --formato sesion
```

El CLI (`apps/api/src/ingest.ts`) descarga la página con una cabecera de Chrome de escritorio, extrae título, fecha y párrafos (`apps/api/src/extract.ts`) y escribe `corpus/figuras/textos/<figura>/<fecha>-<slug>.json`. Con `--file ruta.txt` bypasa el fetch para cargas manuales (necesario cuando el sitio de origen sólo renderiza con JavaScript). Ver `corpus/figuras/README.md` para las reglas completas.

### Datos

```
corpus/figuras/figuras.json                 # id, nombre, cargo, país, idioma, color por figura
corpus/figuras/textos/<figuraId>/<fecha>-<slug>.json   # TextoMeta + { text } literal
```

`apps/api/src/figuras.ts` valida cada archivo (fuente http(s), figura conocida, fecha `YYYY-MM-DD`, formato válido, texto entre 40 y 40.000 caracteres) y lanza con la ruta del archivo si algo no cumple.

## Principios

1. No verifica hechos. Mide si una frase se compromete a algo comprobable.
2. No puntúa personas, puntúa textos. Nada se atribuye a nadie sin enlace a la fuente.
3. La rúbrica es pública y se puede aplicar a mano. Está en `packages/rhetoric/src/questions.ts` y en la página Método.
4. Las actas se identifican por hash del texto. No se guarda quién pegó qué.

## Desarrollo

```sh
pnpm lint:fix && pnpm typecheck && pnpm test
```
