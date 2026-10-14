import { parse, validate } from "@tma.js/init-data-node";
import { config } from "./config.js";

const INIT_DATA_TTL_SECONDS = 12 * 3600;
const DEV_USER_PATTERN = /^(\d{1,15})(?::([\p{L}\p{N} _.-]{1,40}))?$/u;

export interface Identity {
  userId: number;
  displayName: string;
  username: string | null;
  isAdmin: boolean;
}

export class AuthError extends Error {}

function fromUser(user: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}): Identity {
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `id${user.id}`;
  return {
    userId: user.id,
    displayName,
    username: user.username ?? null,
    isAdmin: config.adminIds.has(user.id),
  };
}

export function identityFromInitData(rawInitData: string): Identity {
  if (!config.BOT_TOKEN) throw new AuthError("Telegram auth is not configured");
  try {
    validate(rawInitData, config.BOT_TOKEN, { expiresIn: INIT_DATA_TTL_SECONDS });
  } catch {
    throw new AuthError("Сессия Telegram устарела. Закройте и снова откройте приложение");
  }
  const user = parse(rawInitData).user;
  if (!user) throw new AuthError("В initData нет пользователя");
  return fromUser({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
  });
}

export function identityFromDevUser(value: string): Identity | null {
  if (config.isProduction) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const match = DEV_USER_PATTERN.exec(decoded.trim());
  if (!match?.[1]) return null;
  const userId = Number(match[1]);
  return fromUser({ id: userId, first_name: match[2] ?? `Игрок ${userId}` });
}
