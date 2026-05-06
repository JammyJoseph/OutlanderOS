/**
 * Sync engine boot module.
 * Imported from the root layout so the engine starts when the Next.js
 * server boots. Singleton-safe — repeat imports are no-ops.
 */
import "server-only";
import { getSyncEngine } from "./sync-engine";

const globalForBoot = globalThis as unknown as { __syncEngineBooted?: boolean };

if (!globalForBoot.__syncEngineBooted) {
  globalForBoot.__syncEngineBooted = true;
  if (process.env.SYNC_ENGINE_DISABLED !== "1") {
    try {
      const engine = getSyncEngine();
      engine.start();
    } catch (err) {
      console.error("[sync-engine-boot] failed to start:", err);
    }
  } else {
    console.log("[sync-engine-boot] disabled via SYNC_ENGINE_DISABLED=1");
  }
}

export {};
