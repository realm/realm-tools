# ROS Sync Label Migrator

This tool helps update the /__admin Realm with new `syncLabel` values, useful when migrating Realm files to a different sync worker.

## Example usage

First locate the instance in the Realm Cloud Admin dashboard.

Select "Copy Instance URL" from the dropdown to get the server instance URL:

    https://gorgeous-rubber-hat.us1a.cloud.realm.io/

and select "Get Admin Token" from the dropdown.

    eyJhbGciOiJSUzI1NiIsInR5cCI6Ik…

craft a .json file (such as the labels-example.json provided) containing a single object mapping paths to new sync labels:

```json
{
  "/some/file/path": "some-other-label"
}
```

Invoke the script by running 

    ./bin/ros-sync-label-migrator -s https://gorgeous-rubber-hat.us1a.cloud.realm.io/ -t eyJhbGciOiJSUzI1NiIsInR5cCI6Ik… -l labels-example.json

This will authenticate against the realm object server, iterate 
