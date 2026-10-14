import { z } from "zod";

const PLACEHOLDER_TOKEN = "your_telegram_bot_token_here";

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
    APP_VERSION: z.string().default("dev"),
    BOT_TOKEN: z
      .string()
      .optional()
      .transform((value) => (value && value !== PLACEHOLDER_TOKEN ? value : undefined)),
    PUBLIC_URL: z.url().optional(),
    WEBAPP_URL: z.url().optional(),
    WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/)
      .optional(),
    ADMIN_IDS: idList,
    SUPER_ADMIN_IDS: idList,
    WEB_DIST_DIR: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (!env.PUBLIC_URL)
      ctx.addIssue({ code: "custom", path: ["PUBLIC_URL"], message: "required in production" });
    if (!env.BOT_TOKEN) return;
    if (!env.WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["WEBHOOK_SECRET"],
        message: "required with BOT_TOKEN in production",
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
  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    webAppUrl: env.WEBAPP_URL ?? env.PUBLIC_URL ?? "http://localhost:5173",
    adminIds: new Set([...env.ADMIN_IDS, ...env.SUPER_ADMIN_IDS]),
  };
}

export const config = loadConfig();
