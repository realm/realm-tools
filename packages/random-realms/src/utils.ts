import Debug from "debug";

const debug = Debug("realm-js-random-files");

export function createDebugger(namespace: string) {
  return debug.extend(namespace);
}
