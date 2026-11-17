import { fileURLToPath } from "node:url";
import { z } from "zod";

const PLACEHOLDER_TOKEN = "your_telegram_bot_token_here";

const cleanOptional = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed !== PLACEHOLDER_TOKEN ? trimmed : undefined;
  });

const idList = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isSafeInteger),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    APP_VERSION: z.string().default("2.0.0"),
    BOT_TOKEN: cleanOptional,
    ADMIN_BOT_TOKEN: cleanOptional,
    PUBLIC_URL: z.url().optional(),
    WEBAPP_URL: z.url().optional(),
    WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/)
      .optional(),
    OPENROUTER_API_KEY: cleanOptional,
    GEMINI_API_KEY: cleanOptional,
    AI_MODEL: z.string().trim().min(1).default("google/gemini-3.8-flash"),
    ADMIN_IDS: idList,
    SUPER_ADMIN_IDS: idList,
    WEB_DIST_DIR: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    PGLITE_DIR: z.string().default(".data/pglite"),
    MIGRATIONS_DIR: z.string().default(fileURLToPath(new URL("../../drizzle", import.meta.url))),
    BOT_POLLING: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SEED_DEMO_TEAMS: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (!env.PUBLIC_URL)
      ctx.addIssue({ code: "custom", path: ["PUBLIC_URL"], message: "required in production" });
    if (!env.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "required in production" });
    }
    if (!env.BOT_TOKEN && !env.ADMIN_BOT_TOKEN) return;
    if (!env.WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["WEBHOOK_SECRET"],
        message: "required with BOT_TOKEN / ADMIN_BOT_TOKEN in production",
      });
    }
    if (env.ADMIN_IDS.length + env.SUPER_ADMIN_IDS.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ADMIN_IDS"],
        message: "at least one admin is required in production",
      });
    }
  });

function loadConfig() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  const webAppUrl = env.WEBAPP_URL ?? env.PUBLIC_URL ?? "http://localhost:5173";
  const adminWebAppUrl = `${webAppUrl.replace(/\/$/, "")}/?surface=admin`;
  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    webAppUrl,
    adminWebAppUrl,
    adminIds: new Set([...env.ADMIN_IDS, ...env.SUPER_ADMIN_IDS]),
    seedDemoTeams: env.SEED_DEMO_TEAMS ?? env.NODE_ENV !== "production",
  };
}

export const config = loadConfig();
