// ⚠️ VERIFY AT HACKATHON START — InsForge SDK init pattern
// Run: node -e "const m=require('@insforge/sdk'); console.log(Object.keys(m))"
// Then uncomment the correct pattern below and delete the other.

import { config } from "../../config";

// -------------------------------------------------------------------
// Pattern A: constructor (try this first)
// -------------------------------------------------------------------
// import { InsForge } from "@insforge/sdk";
// const _client = new InsForge({ url: config.INSFORGE_URL, apiKey: config.INSFORGE_SERVICE_KEY });

// -------------------------------------------------------------------
// Pattern B: createClient factory (Codex flagged this may be correct)
// -------------------------------------------------------------------
// import { createClient } from "@insforge/sdk";
// const _client = createClient({ baseUrl: config.INSFORGE_URL, anonKey: config.INSFORGE_SERVICE_KEY });

// -------------------------------------------------------------------
// TEMPORARY: export a placeholder until verified
// Replace the export below with your verified client instance.
// -------------------------------------------------------------------
export let insforge: ReturnType<typeof buildClient>;

function buildClient() {
  // After verifying the correct pattern, replace this entire function
  // with the correct init and remove this comment.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@insforge/sdk") as Record<string, (...args: unknown[]) => unknown>;
    const keys = Object.keys(sdk);
    console.log("[insforge/client] SDK exports:", keys);

    if (sdk["createClient"]) {
      // Pattern B
      const client = sdk["createClient"]({ baseUrl: config.INSFORGE_URL, anonKey: config.INSFORGE_SERVICE_KEY });
      console.log("[insforge/client] using createClient (Pattern B)");
      return client;
    } else if (sdk["InsForge"]) {
      // Pattern A
      const InsForge = sdk["InsForge"] as new (opts: { url: string; apiKey: string }) => unknown;
      const client = new InsForge({ url: config.INSFORGE_URL, apiKey: config.INSFORGE_SERVICE_KEY });
      console.log("[insforge/client] using new InsForge (Pattern A)");
      return client;
    } else {
      throw new Error(`Unknown SDK shape. Exports: ${keys.join(", ")}`);
    }
  } catch (err) {
    console.error("[insforge/client] FATAL: could not init InsForge SDK:", err);
    process.exit(1);
  }
}

// Initialize on module load
insforge = buildClient();
