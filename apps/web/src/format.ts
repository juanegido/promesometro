export const f2 = (n: number) => n.toFixed(2);
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const TIPO_LABEL: Record<string, string> = {
  compromiso: "compromiso",
  diagnostico: "diagnóstico",
  valor: "valores",
  ataque: "ataque",
  relleno: "relleno",
};
export const TEMA_LABEL: Record<string, string> = {
  economia: "economía",
  seguridad: "seguridad",
  salud: "salud",
  educacion: "educación",
  vivienda: "vivienda",
  ambiente: "ambiente",
  instituciones: "instituciones",
  social: "social",
  exterior: "exterior",
  otro: "otro",
};
export const NIVEL_LABEL = ["vago", "intención", "medida", "medible", "medible + instrumento"];
export const TONO_LABEL = ["frío", "firme", "inflamado", "beligerante"];
export const MOV_LABEL: Record<string, string> = {
  cumple: "CUMPLE",
  mantiene: "MANTIENE",
  diluye: "DILUYE",
  contradice: "CONTRADICE",
  cambia_de_tema: "CAMBIA DE TEMA",
};
export const isJev = (engine: string) => !engine.startsWith("heuristico");
