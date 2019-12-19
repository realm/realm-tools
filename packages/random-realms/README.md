# random-realms

## Installing dependencies and building the tool

    npm install
    npm run build

## Running the tool

Once dependencies are installed and the tool has been build, it can run:

    ./bin/random-realms -h

```
random-realms [output-directory]

Generate a random Realm file

Commands:
  random-realms generate                    Generate a random Realm file
  [output-directory]                                                   [default]

Positionals:
  output-directory  The path of a directory to put the Realm file       [string]

Options:
  --version                  Show version number                       [boolean]
  --verbose, -v              Print more information   [boolean] [default: false]
  --endlessly, -e            Run the generator in a loop, until the process gets
                             interrupted                               [boolean]
  --seed, -s                 A seed for the pseudo-random generator     [string]
  --check-upgrade, -u        Check the contents before and after a Core 5 → 6
                             upgrade (requires MacOS)                  [boolean]
  --name-ridiculousness, -r  [choices: "low", "medium", "high"] [default: "low"]
  --max-object-count         Maxumum number of objects generated  [default: 100]
  --max-data-size            Maxumum number of bytes in a property of type
                             'data'                                [default: 10]
  --max-list-elements        Maxumum number of elements in a property of type
                             'list'                                [default: 10]
  --max-object-schemas       Maxumum number of different types of objects
                                                                    [default: 3]
  --max-properties           Maxumum number of different properties on a type of
                             object                                 [default: 3]
  -h, --help                 Show help                                 [boolean]
```