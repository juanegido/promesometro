import type { DocumentVerdict } from "@jev/rhetoric";
import { f2, NIVEL_LABEL, TIPO_LABEL } from "./format.js";

/** Draw the shareable 1080x1350 acta on a canvas. Pure canvas so the PNG matches what is shown. */
export function drawCard(canvas: HTMLCanvasElement, v: DocumentVerdict, dark: boolean) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const paper = dark ? "#131210" : "#f4f1ea";
  const ink = dark ? "#ece7dc" : "#14130f";
  const muted = dark ? "#8b8477" : "#7d776b";
  const red = dark ? "#e0463a" : "#b3261e";
  const serif = "'Fraunces', Georgia, serif";
  const mono = "'JetBrains Mono', Menlo, monospace";
  const M = 72;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = ink;
  ctx.font = `900 44px ${serif}`;
  ctx.fillText("PROMES", M, M + 40);
  const w = ctx.measureText("PROMES").width;
  ctx.fillStyle = red;
  ctx.fillText("Ó", M + w, M + 40);
  const w2 = ctx.measureText("Ó").width;
  ctx.fillStyle = ink;
  ctx.fillText("METRO", M + w + w2, M + 40);
  ctx.font = `400 18px ${mono}`;
  ctx.fillStyle = muted;
  ctx.fillText("acta de concreción del discurso político", M, M + 72);

  ctx.fillStyle = ink;
  ctx.fillRect(M, M + 96, W - 2 * M, 3);
  ctx.fillRect(M, M + 103, W - 2 * M, 1);

  // Title
  ctx.font = `600 40px ${serif}`;
  wrap(ctx, v.title ?? "Texto sin título", M, M + 160, W - 2 * M, 46, 2);
  ctx.font = `400 17px ${mono}`;
  ctx.fillStyle = muted;
  ctx.fillText(trim(v.source ?? "texto pegado por el usuario", 70), M, M + 250);

  // Big number
  const y0 = M + 330;
  ctx.fillStyle = ink;
  ctx.font = `600 200px ${mono}`;
  ctx.fillText(f2(v.resumen.concrecionMedia), M - 8, y0 + 150);
  ctx.font = `400 20px ${mono}`;
  ctx.fillStyle = muted;
  ctx.fillText("CONCRECIÓN MEDIA / 4", M, y0 + 190);

  // Stamp
  const sx = W - M - 300;
  const sy = y0 + 20;
  ctx.save();
  ctx.translate(sx + 150, sy + 60);
  ctx.rotate(-0.06);
  ctx.strokeStyle = red;
  ctx.lineWidth = 6;
  ctx.strokeRect(-150, -60, 300, 120);
  ctx.fillStyle = red;
  ctx.font = `600 18px ${mono}`;
  ctx.textAlign = "center";
  ctx.fillText("COMPROMISOS MEDIBLES", 0, -18);
  ctx.font = `600 64px ${mono}`;
  ctx.fillText(String(v.resumen.medibles), 0, 40);
  ctx.restore();
  ctx.textAlign = "left";

  // Level bars
  const by = y0 + 250;
  ctx.fillStyle = ink;
  ctx.font = `400 16px ${mono}`;
  const total = Math.max(1, v.resumen.segmentos);
  v.resumen.niveles.forEach((n, i) => {
    const y = by + i * 40;
    ctx.fillStyle = muted;
    ctx.fillText(`${i} ${NIVEL_LABEL[i]}`, M, y + 14);
    const bw = ((W - 2 * M - 330) * n) / total;
    ctx.fillStyle = i >= 3 ? red : ink;
    ctx.fillRect(M + 270, y + 2, Math.max(2, bw), 14);
    ctx.fillStyle = ink;
    ctx.fillText(String(n), M + 290 + bw, y + 14);
  });

  // Type split
  const ty = by + 5 * 40 + 24;
  ctx.fillStyle = muted;
  ctx.font = `400 15px ${mono}`;
  const parts = Object.entries(v.resumen.porTipo)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${TIPO_LABEL[k]} ${Math.round((n / total) * 100)}%`)
    .join("  ·  ");
  ctx.fillText(parts, M, ty);

  // Top commitments
  let cy = ty + 60;
  ctx.fillStyle = ink;
  ctx.fillRect(M, cy - 30, W - 2 * M, 1);
  ctx.font = `400 15px ${mono}`;
  ctx.fillStyle = muted;
  ctx.fillText("LO MÁS CONCRETO QUE DICE", M, cy);
  cy += 34;
  ctx.fillStyle = ink;
  ctx.font = `400 24px ${serif}`;
  const tops = v.compromisosMedibles.slice(0, 3);
  if (tops.length === 0) {
    ctx.fillStyle = muted;
    ctx.font = `italic 400 24px ${serif}`;
    ctx.fillText("Ninguna frase alcanza el nivel medible.", M, cy);
  }
  for (const s of tops) {
    ctx.fillStyle = red;
    ctx.font = `600 18px ${mono}`;
    ctx.fillText(f2(s.concrecion), M, cy);
    ctx.fillStyle = ink;
    ctx.font = `400 24px ${serif}`;
    const lines = wrap(ctx, `“${s.text}”`, M + 80, cy, W - 2 * M - 80, 32, 3);
    cy += lines * 32 + 22;
    if (cy > H - 150) break;
  }

  // Footer
  ctx.fillStyle = ink;
  ctx.fillRect(M, H - 110, W - 2 * M, 1);
  ctx.font = `italic 500 26px ${serif}`;
  ctx.fillText("No mide verdad. Mide compromiso.", M, H - 68);
  ctx.font = `400 14px ${mono}`;
  ctx.fillStyle = muted;
  ctx.textAlign = "right";
  ctx.fillText(`motor ${v.engine} · acta ${v.hash}`, W - M, H - 68);
  ctx.textAlign = "left";
}

function trim(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
  maxLines: number,
): number {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : (words[i] as string);
    if (ctx.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) {
        ctx.fillText(`${trim(line, line.length - 1)}…`, x, y + lines * lh);
        return lines + 1;
      }
      ctx.fillText(line, x, y + lines * lh);
      lines++;
      line = words[i] as string;
    } else line = test;
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lh);
    lines++;
  }
  return lines;
}
