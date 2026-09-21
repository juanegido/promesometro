import { signal } from "@preact/signals";

export const path = signal(location.pathname);

export function navigate(to: string) {
  history.pushState(null, "", to);
  path.value = to;
  window.scrollTo({ top: 0 });
}

window.addEventListener("popstate", () => {
  path.value = location.pathname;
});

/** Intercept in-app links so Preact handles them. */
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("a");
  if (!a || a.target === "_blank" || !a.href.startsWith(location.origin)) return;
  if (a.hasAttribute("download") || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(a.pathname + a.search);
});
