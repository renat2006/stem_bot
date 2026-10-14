import { request } from "../../../shared/api/index.js";
import type { GameSnapshot } from "../model/types.js";

export const fetchGameSnapshot = () => request<GameSnapshot>("/api/game/state");
