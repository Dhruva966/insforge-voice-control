import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../.env" });

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-live-preview"),
  GEMINI_VOICE: z.string().default("Puck"),

  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TWILIO_WEBHOOK_BASE: z.string().url(),

  INSFORGE_URL: z.string().url(),
  INSFORGE_KEY: z.string().min(1),

  REPLICAS_API_KEY: z.string().optional(),

  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:");
  for (const err of result.error.errors) {
    console.error(`  ${err.path.join(".")}: ${err.message}`);
  }
  process.exit(1);
}

export const config = result.data;
