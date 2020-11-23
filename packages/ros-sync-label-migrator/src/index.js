const Realm = require("realm");

Realm.Sync.setLogLevel("error");

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option("server-url", {
    alias: "s",
    description: "URL of the realm object server",
    demandOption: true,
  })
  .option("admin-token", {
    alias: "t",
    description: "Admin token used when authenticating towards the server",
    demandOption: true,
  })
  .option("labels-path", {
    alias: "l",
    description: "A JSON file with a 'path' to 'label' maping",
    coerce: arg => JSON.parse(require('fs').readFileSync(arg, 'utf8')),
    demandOption: true,
  })
  .help()
  .argv
 
async function performMigration({ serverUrl, adminToken, labels }) {
  // Authenticate
  const credentials = Realm.Sync.Credentials.jwt(adminToken, "jwt/central-owner");
  const user = await Realm.Sync.User.login(serverUrl, credentials);
  console.log(`Authenticated as ${user.identity}`);
  // Open the admin Realm
  const config = user.createConfiguration({ sync: { url: "/__admin", fullSynchronization: true } });
  const realm = await Realm.open(config);
  // Perform the migration
  const realmFiles = realm.objects("RealmFile");
  console.log(`Found ${realmFiles.length} Realm files`);
  realm.write(() => {
    for (const [path, syncLabel] of Object.entries(labels)) {
      const realmFile = realm.objectForPrimaryKey("RealmFile", path);
      if (realmFile) {
        console.log(`Migrating '${path}' to '${syncLabel}'`);
        realmFile.syncLabel = syncLabel;
      } else {
        throw new Error(`Cannot migrate '${path}', since it does not exist in /__admin Realm`);
      }
    }
    console.log("Committing transaction!");
  });
  // Await upload of all changes
  console.log("Awaiting upload of changes ...");
  await realm.syncSession.uploadAllLocalChanges();
}

performMigration({
  serverUrl: argv["server-url"],
  adminToken: argv["admin-token"],
  labels: argv["labels-path"],
}).then(() => {
  console.log("All done - exiting");
  // Close the process
  process.exit();
}, err => {
  console.error(err);
  process.exit(1);
});
