import assert from "assert";
import cp from "child_process";
import path from "path";
import util from "util";

import { createDebugger } from "./utils";

export class RealmDiffer {
  private debug = createDebugger("RealmDiffer");
  private readonly coreVersions = ["5.23.6", "6.0.0"];

  public check(realmPath: string) {
    const dumps: { [version: string]: any } = {};
    for (const version of this.coreVersions) {
      this.debug(`Running realm2json-${version} on ${realmPath}`);
      const dump = this.realm2json(version, realmPath);
      // Delete the pk table (from core 5), metadata (which has changed) and _key on objects (from core 6)
      delete dump.pk;
      delete dump.metadata;
      for (const objects of Object.values(dump)) {
        if (Array.isArray(objects)) {
          for (const object of objects) {
            delete object._key;
          }
        }
      }
      dumps[version] = dump;
    }
    // Compare
    const [firstVersion, ...otherVersions] = this.coreVersions;
    const firstDump = dumps[firstVersion];
    for (const otherVersion of otherVersions) {
      const otherDump = dumps[otherVersion];
      assert.deepEqual(firstDump, otherDump);
    }
  }

  public realm2json(version: string, realmPath: string) {
    const executablePath = path.resolve(
      __dirname,
      `../bin/realm2json-${version}`,
    );
    const p = cp.spawnSync(executablePath, [realmPath], { encoding: "utf8" });
    if (p.status === 0) {
      return JSON.parse(p.stdout);
    } else {
      throw new Error(`Error running ${executablePath}: ${p.stderr}`);
    }
  }
}
