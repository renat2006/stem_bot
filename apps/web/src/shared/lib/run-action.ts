export type RunAction = (action: () => Promise<unknown>) => Promise<boolean>;
