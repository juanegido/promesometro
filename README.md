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
| `apps/web` | Vite + Preact. Vistas: Analizar, Antes y después, Corpus, Método. Tarjeta PNG en canvas. |
| `corpus/` | Textos públicos con fuente obligatoria. Ver `corpus/README.md`. |

## Arrancar

```sh
pnpm install
pnpm build
cp .env.example .env        # opcional: TYPESAFE_API_KEY para usar Jev
pnpm start                   # http://localhost:8787
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

## Principios

1. No verifica hechos. Mide si una frase se compromete a algo comprobable.
2. No puntúa personas, puntúa textos. Nada se atribuye a nadie sin enlace a la fuente.
3. La rúbrica es pública y se puede aplicar a mano. Está en `packages/rhetoric/src/questions.ts` y en la página Método.
4. Las actas se identifican por hash del texto. No se guarda quién pegó qué.

## Desarrollo

```sh
pnpm lint:fix && pnpm typecheck && pnpm test
```
