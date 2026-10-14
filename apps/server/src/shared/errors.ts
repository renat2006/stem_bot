import type { ContentfulStatusCode } from "hono/utils/http-status";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: ContentfulStatusCode = 400,
  ) {
    super(message);
  }
}
