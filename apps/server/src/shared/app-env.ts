import type { Identity } from "./identity.js";

export interface AppEnv {
  Variables: {
    identity?: Identity;
  };
}
