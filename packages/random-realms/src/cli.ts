// Importing source-map-support's register submodule is documented to be supported
// tslint:disable-next-line:no-submodule-imports
import "source-map-support/register";

// Logging to the console is expected from a CLI
// tslint:disable:no-console

import Chance from "chance";
import cp from "child_process";
import fs from "fs-extra";
import path from "path";
import Yargs from "yargs";

import { RealmDiffer } from "./realm-differ";
import { RealmFactory, RidiculousnessLevel } from "./realm-factory";

const chance = Chance();

function generateSeed() {
  return chance.hash({ length: 16 });
}

function generateRandomFilePath() {
  const outputDirectory = path.resolve("realms");
  // Ensure the output directory exists
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }
  const name = chance.hash({ length: 8 });
  const randomDirectory = path.resolve(outputDirectory, name);
  fs.mkdirSync(randomDirectory);
  return randomDirectory;
}

// Calling .argv is how to get yargs to parse the runtime arguments
// tslint:disable-next-line:no-unused-expression
Yargs.help()
  .alias("h", "help")
  .command(
    ["generate [output-directory]", "$0 [output-directory]"],
    "Generate a random Realm file",
    yargs => {
      return yargs
        .option("verbose", {
          alias: "v",
          describe: "Print more information",
          type: "boolean",
          default: false,
        })
        .option("endlessly", {
          alias: "e",
          describe:
            "Run the generator in a loop, until the process gets interrupted",
          type: "boolean",
        })
        .option("seed", {
          alias: "s",
          describe: "A seed for the pseudo-random generator",
          type: "string",
        })
        .conflicts("endlessly", "seed")
        .positional("output-directory", {
          describe: "The path of a directory to put the Realm file",
          type: "string",
        })
        .coerce("output-directory", path.resolve)
        .option("check-upgrade", {
          alias: "u",
          describe:
            "Check the contents before and after a Core 5 → 6 upgrade (requires MacOS)",
          type: "boolean",
        })
        .option("name-ridiculousness", {
          alias: "r",
          descrive:
            'How ridiculous should names of object schemas and properties be? "low" will only use PascalCase and camelCase, "medium" will use alphanummeric and symbols, "high" will use any valid unicode charecter',
          choices: ["low", "medium", "high"],
          default: "low",
        })
        .option("max-object-count", {
          describe: "Maxumum number of objects generated",
          default: 100,
        })
        .option("max-data-size", {
          describe: "Maxumum number of bytes in a property of type 'data'",
          default: 10,
        })
        .option("max-list-elements", {
          describe: "Maxumum number of elements in a property of type 'list'",
          default: 10,
        })
        .option("max-object-schemas", {
          describe: "Maxumum number of different types of objects",
          default: 3,
        })
        .option("max-properties", {
          describe:
            "Maxumum number of different properties on a type of object",
          default: 3,
        });
    },
    argv => {
      const endlessly = argv.endlessly;
      if (endlessly) {
        let runs = 0;
        function runGenerate() {
          try {
            // Start a sub-process calling the generator (to protect it from segfaults)
            const seed = generateSeed();
            // Pass along all other compatible string arguments
            const extraArgNames = [
              "verbose",
              "output-directory",
              "name-ridiculousness",
              "check-upgrade",
              "max-object-count",
              "max-data-size",
              "max-list-elements",
              "max-object-schemas",
              "max-properties",
            ];
            const extraArgs = [];
            for (const n of extraArgNames) {
              if (n in argv) {
                extraArgs.push(`--${n}`, argv[n] as string);
              }
            }
            runs++;
            console.log(`Starting generator #${runs}`);
            // Spawn the generate process
            cp.spawnSync(
              process.execPath,
              [module.id, "generate", "--seed", seed, ...extraArgs],
              { stdio: "inherit", env: { REALM_DISABLE_ANALYTICS: "true" } },
            );
          } catch (err) {
            console.error(err);
          }
        }
        // Create an interval running the generate command
        const runInterval = setInterval(runGenerate, 0);
        // Make the main loop stop, when the process receives an interrupt
        process.on("SIGINT", () => {
          console.log("Received SIGINT - stopping generators");
          clearTimeout(runInterval);
          process.exit(0);
        });
      } else {
        const seed = argv.seed || generateSeed();
        const outputDirectory =
          argv["output-directory"] || generateRandomFilePath();
        const nameRidiculousness = argv[
          "name-ridiculousness"
        ] as RidiculousnessLevel;
        const checkUpgrade = argv["check-upgrade"] || false;
        const options = {
          seed,
          nameRidiculousness,
          maxObjectCount: argv["max-object-count"],
          maxDataSize: argv["max-data-size"],
          maxListElements: argv["max-list-elements"],
          maxObjectSchemas: argv["max-object-schemas"],
          maxProperties: argv["max-properties"],
        };
        // Print the options used
        const optionsString = !argv.verbose
          ? `seed = ${seed}`
          : Object.entries(options)
              .map(([name, value]) => `${name} = ${value}`)
              .join(", ");
        console.log(
          `Generating Realm in "${outputDirectory}" (${optionsString})`,
        );
        // Generate Realm
        const factory = new RealmFactory({ chance, ...options });
        const outputPath = path.resolve(outputDirectory, "generated.realm");
        try {
          const realm = factory.makeRealm(outputPath);
          const objectCount = realm.schema.reduce(
            (sum, objectSchema) =>
              sum + realm.objects(objectSchema.name).length,
            0,
          );
          const facts = [
            `${realm.schema.length} object schemas`,
            `${objectCount} objects`,
          ];
          console.log(`Generated: ${facts.join(", ")}`);
          realm.close();
          if (checkUpgrade) {
            try {
              const differ = new RealmDiffer();
              differ.check(outputPath);
              console.error("✓ Upgrade check succeeded!");
            } catch (err) {
              console.error("💥 Upgrade check failed!");
              throw err; // Rethrow
            }
          }
        } catch (err) {
          const failedSeedsPath = path.resolve("./failed-seeds.log");
          const msg = err.message || "No error message";
          fs.appendFileSync(failedSeedsPath, `[${seed}] ${msg}\n`);
          console.error(err.stack);
          process.exit(1);
        }
      }
    },
  ).argv;
