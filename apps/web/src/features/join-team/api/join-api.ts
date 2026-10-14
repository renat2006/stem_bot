import type { LiveState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export const joinTeam = (code: string, displayName: string) =>
  postJson<LiveState>("/api/team/join", { code, displayName });
