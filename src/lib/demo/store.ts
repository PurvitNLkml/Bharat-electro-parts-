import { createSeedStore } from "./seed";
import type { Store } from "@/lib/domain/types";

const globalStore = globalThis as typeof globalThis & { __bepStore?: Store };

export function getStore(): Store {
  if (!globalStore.__bepStore) globalStore.__bepStore = createSeedStore();
  return globalStore.__bepStore;
}

export function resetStore(now = new Date()): Store {
  globalStore.__bepStore = createSeedStore(now);
  return globalStore.__bepStore;
}
