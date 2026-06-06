import { createAdminClient } from "@insforge/sdk";
import { config } from "../../config";

export const insforge = createAdminClient({
  baseUrl: config.INSFORGE_URL,
  apiKey: config.INSFORGE_KEY,
});
