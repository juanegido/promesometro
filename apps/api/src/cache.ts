import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Memory-first cache with a JSON file behind it, keyed by document hash. */
export class VerdictCache<T> {
  #mem = new Map<string, T>();
  #dir: string | null;
  #max: number;

  constructor(dir: string | null, max = 500) {
    this.#dir = dir;
    this.#max = max;
  }

  async get(key: string): Promise<T | undefined> {
    const hit = this.#mem.get(key);
    if (hit) return hit;
    if (!this.#dir) return undefined;
    try {
      const raw = await readFile(join(this.#dir, `${key}.json`), "utf8");
      const value = JSON.parse(raw) as T;
      this.#remember(key, value);
      return value;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: T): Promise<void> {
    this.#remember(key, value);
    if (!this.#dir) return;
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, `${key}.json`), JSON.stringify(value));
  }

  #remember(key: string, value: T) {
    if (this.#mem.size >= this.#max) {
      const oldest = this.#mem.keys().next().value;
      if (oldest !== undefined) this.#mem.delete(oldest);
    }
    this.#mem.set(key, value);
  }
}
