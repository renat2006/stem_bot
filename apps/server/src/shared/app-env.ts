import type { parse } from "@tma.js/init-data-node";

export interface AppEnv {
  Variables: {
    tmaInitData?: ReturnType<typeof parse>;
  };
}
