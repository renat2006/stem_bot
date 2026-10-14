import { isValid, parse, validate } from "@tma.js/init-data-node";

export function verifyTelegramInitData(rawInitData: string, botToken: string): boolean {
  if (!rawInitData || !botToken) return false;
  return isValid(rawInitData, botToken);
}

export function validateAndParseInitData(rawInitData: string, botToken: string) {
  validate(rawInitData, botToken, { expiresIn: 86400 });
  return parse(rawInitData);
}
