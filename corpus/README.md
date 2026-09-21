# Corpus

Textos políticos públicos, cada uno con su fuente. Un archivo JSON por texto:

```json
{
  "id": "es-2023-programa-ejemplo",
  "title": "Programa electoral 2023",
  "author": "Partido X",
  "country": "ES",
  "date": "2023-06-01",
  "kind": "programa",
  "source": "https://…/programa.pdf",
  "note": "Extracto: capítulos 1 a 3.",
  "text": "…"
}
```

Reglas:

- `source` es obligatorio y debe enlazar al documento original o a una transcripción oficial.
- `kind` es `programa`, `discurso`, `declaracion` o `sintetico`. Un texto sintético no puede llevar el nombre de una persona o partido real como `author`.
- El texto se pega literal. Sin resúmenes, sin paráfrasis. Si es un extracto, `note` dice qué parte.
- Máximo 40.000 caracteres por archivo; el juez procesa hasta 160 frases.
