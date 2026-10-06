import { join } from "node:path";
import type {
  DocumentVerdict,
  Figura,
  FiguraMetrics,
  SegmentVerdict,
  TextoMeta,
} from "@jev/rhetoric";
import { NIVEL_ETIQUETA } from "@jev/rhetoric";
import { Resvg } from "@resvg/resvg-js";

const W = 1200;
const H = 630;
const M = 60;
const PAPER = "#f4f1ea";
const INK = "#14130f";
const MUTED = "#7d776b";
const RED = "#b3261e";
const GREEN = "#2e8b57";

const fontsDir = join(import.meta.dirname, "../fonts");
const fontFiles = [
  join(fontsDir, "JetBrainsMono-Regular.ttf"),
  join(fontsDir, "JetBrainsMono-Bold.ttf"),
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap by estimating 0.6em per character, exact for a monospace font. */
function wrapLines(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.6)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let consumed = false;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) {
        consumed = true;
        break;
      }
    } else {
      line = test;
    }
  }
  if (!consumed) {
    if (line) lines.push(line);
  } else if (line) {
    // there is leftover text beyond maxLines: ellipsize the last kept line
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] =
      last.length > maxChars - 1 ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines.slice(0, maxLines);
}

function tspans(lines: string[], x: number, y: number, lineHeight: number): string {
  return lines
    .map((l, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${escapeXml(l)}</tspan>`)
    .join("");
}

function wordmark(x: number, y: number, size: number): string {
  return `<text x="${x}" y="${y}" font-family="JetBrains Mono" font-weight="700" font-size="${size}" fill="${INK}">PROMES<tspan fill="${RED}">Ó</tspan>METRO</text>`;
}

/**
 * Badge label/color for a segment. `relleno` is excluded from the humo metric by
 * definition, so it always gets its own neutral badge regardless of nivel.
 */
function nivelBadge(nivel: number, tipo: string): { label: string; color: string } {
  if (tipo === "relleno") return { label: "relleno", color: INK };
  const label = NIVEL_ETIQUETA[nivel] ?? "medible";
  const color = nivel <= 1 ? RED : nivel === 2 ? INK : GREEN;
  return { label, color };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function render(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "JetBrains Mono" },
  });
  return resvg.render().asPng();
}

/** Raw SVG string for the frase card. Exported separately so tests can assert escaping. */
export function buildFraseSvg(
  texto: TextoMeta,
  segment: SegmentVerdict,
  figura: Figura,
  n: number,
): string {
  const badge = nivelBadge(segment.nivel, segment.tipo);
  const quoteLines = wrapLines(`“${segment.text}”`, W - 2 * M, 44, 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    ${wordmark(M, 66, 30)}
    <text font-family="JetBrains Mono" font-size="44" fill="${INK}" font-weight="500">${tspans(quoteLines, M, 150, 54)}</text>
    <rect x="${M}" y="${150 + quoteLines.length * 54 + 20}" width="220" height="34" fill="${badge.color}"/>
    <text x="${M + 12}" y="${150 + quoteLines.length * 54 + 44}" font-family="JetBrains Mono" font-size="16" fill="#fff" font-weight="700">NIVEL ${segment.nivel} · ${badge.label.toUpperCase()}</text>
    <text x="${M}" y="${150 + quoteLines.length * 54 + 78}" font-family="JetBrains Mono" font-size="15" fill="${MUTED}">${escapeXml(segment.tipo)} · ${escapeXml(segment.tema)}</text>
    <text x="${M}" y="${H - 130}" font-family="JetBrains Mono" font-size="20" fill="${INK}" font-weight="700">${escapeXml(figura.nombre)}</text>
    <text x="${M}" y="${H - 106}" font-family="JetBrains Mono" font-size="14" fill="${MUTED}">${escapeXml(figura.cargo)}</text>
    <text x="${M}" y="${H - 80}" font-family="JetBrains Mono" font-size="13" fill="${MUTED}">${escapeXml(texto.fecha)} · ${escapeXml(hostnameOf(texto.source))}</text>
    <line x1="${M}" y1="${H - 58}" x2="${W - M}" y2="${H - 58}" stroke="${INK}" stroke-width="1"/>
    <text x="${M}" y="${H - 30}" font-family="JetBrains Mono" font-size="16" fill="${INK}" font-style="italic">No mide verdad. Mide compromiso.</text>
    <text x="${W - M}" y="${H - 30}" font-family="JetBrains Mono" font-size="12" fill="${MUTED}" text-anchor="end">frase ${n + 1}</text>
  </svg>`;
}

export function ogFrase(
  texto: TextoMeta,
  segment: SegmentVerdict,
  figura: Figura,
  n: number,
): Buffer {
  return render(buildFraseSvg(texto, segment, figura, n));
}

/** Raw SVG string for the figura card. Exported separately so tests can assert escaping. */
export function buildFiguraSvg(figura: Figura, metrics: FiguraMetrics): string {
  const stats: [string, string][] = [
    [`${Math.round(metrics.humo * 100)}%`, "HUMO"],
    [String(metrics.medibles), "MEDIBLES"],
    [`${Math.round(metrics.ataques * 100)}%`, "ATAQUES"],
  ];
  const cw = (W - 2 * M) / 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    ${wordmark(M, 66, 30)}
    <text x="${M}" y="220" font-family="JetBrains Mono" font-size="52" font-weight="700" fill="${INK}">${escapeXml(figura.nombre)}</text>
    <text x="${M}" y="260" font-family="JetBrains Mono" font-size="20" fill="${MUTED}">${escapeXml(figura.cargo)}</text>
    <line x1="${M}" y1="300" x2="${W - M}" y2="300" stroke="${INK}" stroke-width="1"/>
    ${stats
      .map(
        ([value, label], i) => `
      <text x="${M + i * cw}" y="420" font-family="JetBrains Mono" font-size="72" font-weight="700" fill="${INK}">${escapeXml(value)}</text>
      <text x="${M + i * cw}" y="450" font-family="JetBrains Mono" font-size="16" fill="${MUTED}">${label}</text>`,
      )
      .join("")}
    <text x="${M}" y="${H - 30}" font-family="JetBrains Mono" font-size="16" fill="${INK}" font-style="italic">No mide verdad. Mide compromiso.</text>
  </svg>`;
}

export function ogFigura(figura: Figura, metrics: FiguraMetrics): Buffer {
  return render(buildFiguraSvg(figura, metrics));
}

/** Raw SVG string for the texto card. Exported separately so tests can assert escaping. */
export function buildTextoSvg(texto: TextoMeta, figura: Figura, verdict: DocumentVerdict): string {
  const titleLines = wrapLines(texto.titulo, W - 2 * M, 40, 3);
  const stats: [string, string][] = [
    [verdict.resumen.concrecionMedia.toFixed(2), "CONCRECIÓN MEDIA"],
    [String(verdict.resumen.medibles), "MEDIBLES"],
    [String(verdict.resumen.segmentos), "FRASES"],
  ];
  const cw = (W - 2 * M) / 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    ${wordmark(M, 66, 30)}
    <text font-family="JetBrains Mono" font-size="40" font-weight="700" fill="${INK}">${tspans(titleLines, M, 160, 48)}</text>
    <text x="${M}" y="${160 + titleLines.length * 48 + 34}" font-family="JetBrains Mono" font-size="18" fill="${MUTED}">${escapeXml(figura.nombre)} · ${escapeXml(texto.fecha)}</text>
    <line x1="${M}" y1="${H - 190}" x2="${W - M}" y2="${H - 190}" stroke="${INK}" stroke-width="1"/>
    ${stats
      .map(
        ([value, label], i) => `
      <text x="${M + i * cw}" y="${H - 100}" font-family="JetBrains Mono" font-size="56" font-weight="700" fill="${INK}">${escapeXml(value)}</text>
      <text x="${M + i * cw}" y="${H - 74}" font-family="JetBrains Mono" font-size="15" fill="${MUTED}">${label}</text>`,
      )
      .join("")}
    <text x="${M}" y="${H - 30}" font-family="JetBrains Mono" font-size="16" fill="${INK}" font-style="italic">No mide verdad. Mide compromiso.</text>
  </svg>`;
}

export function ogTexto(texto: TextoMeta, figura: Figura, verdict: DocumentVerdict): Buffer {
  return render(buildTextoSvg(texto, figura, verdict));
}

/** Small LRU-ish cache for rendered PNG buffers, keyed by route. */
export class PngCache {
  #map = new Map<string, Buffer>();
  #max: number;
  constructor(max = 500) {
    this.#max = max;
  }
  get(key: string): Buffer | undefined {
    return this.#map.get(key);
  }
  set(key: string, value: Buffer): void {
    if (this.#map.size >= this.#max) {
      const oldest = this.#map.keys().next().value;
      if (oldest !== undefined) this.#map.delete(oldest);
    }
    this.#map.set(key, value);
  }
}
