import type { GameSnapshot } from "@stem/shared";
import { request } from "../../../shared/api/index.js";

export const fetchGameSnapshot = () => request<GameSnapshot>("/api/game/state");
