import type { Segment } from "./types.js";

const MIN_WORDS = 5;

/** Count words the cheap way; good enough for thresholds. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(paragraph: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("es", { granularity: "sentence" });
    return Array.from(seg.segment(paragraph), (s) => s.segment.trim()).filter(Boolean);
  }
  return paragraph
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Split a document into judgeable units: sentences, merged forward when too short to stand
 * alone (bullets, headings, "Sí." style fragments). Paragraph index is kept for rendering.
 */
export function segmentDocument(text: string, maxSegments = 160): Segment[] {
  const out: Segment[] = [];
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\s*[-•*]\s)/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let id = 0;
  paragraphs.forEach((p, paragraph) => {
    const sentences = splitSentences(p.replace(/^[-•*]\s*/, ""));
    let buffer = "";
    for (const s of sentences) {
      buffer = buffer ? `${buffer} ${s}` : s;
      if (wordCount(buffer) >= MIN_WORDS) {
        out.push({ id: id++, paragraph, text: buffer });
        buffer = "";
      }
    }
    if (buffer) {
      const last = out.at(-1);
      if (last && last.paragraph === paragraph) last.text = `${last.text} ${buffer}`;
      else out.push({ id: id++, paragraph, text: buffer });
    }
  });

  return out.slice(0, maxSegments);
}
