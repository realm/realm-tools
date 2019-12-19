import { Chance } from "chance";
import Realm from "realm";
import { inspect } from "util";

import { createDebugger } from "./utils";

const PRIMITIVE_TYPES = [
  "bool",
  "int",
  "float",
  "double",
  "string",
  "data",
  "date",
];

const INDEXABLE_TYPES = ["string", "int", "bool"];

const KEYABLE_TYPES = ["string", "int"];

export function isPrimitive(type: Realm.PropertyType | undefined) {
  return type ? PRIMITIVE_TYPES.includes(type) : false;
}

interface IRealmFactoryOptions {
  chance?: Chance.Chance;
  nameRidiculousness?: RidiculousnessLevel;
  maxObjectSchemas?: number;
  minProperties?: number;
  maxProperties?: number;
  maxListElements?: number;
  maxDataSize?: number;
  maxUnicodeString?: number;
  maxObjectCount?: number;
}

export type RidiculousnessLevel = "low" | "medium" | "high";

export class RealmFactory {
  private readonly chance: Chance.Chance;
  private readonly debug = createDebugger("RealmFactory");
  private readonly nameRidiculousness: RidiculousnessLevel;
  private readonly maxObjectSchemas: number;
  private readonly minProperties: number;
  private readonly maxProperties: number;
  private readonly maxListElements: number;
  private readonly maxDataSize: number;
  private readonly maxUnicodeString: number;
  private readonly maxObjectCount: number;

  private realm: Realm | null = null;

  constructor({
    chance,
    nameRidiculousness = "low",
    maxObjectSchemas = 20,
    minProperties = 1,
    maxProperties = 10,
    maxListElements = 100,
    maxDataSize = 1000,
    maxUnicodeString = 20,
    maxObjectCount = 10000,
  }: IRealmFactoryOptions) {
    this.chance = chance || new Chance();
    this.nameRidiculousness = nameRidiculousness;
    this.maxObjectSchemas = maxObjectSchemas;
    this.minProperties = minProperties;
    this.maxProperties = maxProperties;
    this.maxListElements = maxListElements;
    this.maxDataSize = maxDataSize;
    this.maxUnicodeString = maxUnicodeString;
    this.maxObjectCount = maxObjectCount;
  }

  public makeRealm(path: string): Realm {
    if (this.realm) {
      throw new Error("Already making a Realm");
    } else {
      this.debug("Making a Realm");
      const schema = this.makeRealmSchema();
      // this.debug(`Opening a Realm with schema ${inspect(schema, false, null)}`);
      this.realm = new Realm({ path, schema });
      // TODO: Create a lot of objects ...
      this.makeObjects();
      // Return the Realm object
      const realm = this.realm;
      delete this.realm;
      return realm;
    }
  }

  public makeRealmSchema(): Realm.ObjectSchema[] {
    const objectSchemaCount = this.chance.integer({
      min: 0,
      max: this.maxObjectSchemas,
    });
    this.debug(
      `Making a realm schema with ${objectSchemaCount} object schemas`,
    );
    // Generate all the schema names up-front
    const objectSchemaNames = this.chance.unique(
      this.makeObjectSchemaName,
      objectSchemaCount,
    );
    // Generate all the object schemas
    return objectSchemaNames.map(name =>
      this.makeObjectSchema(name, objectSchemaNames),
    );
  }

  public makeObjectSchema(
    name = this.makeObjectSchemaName(),
    extraTypes: string[] = [],
  ): Realm.ObjectSchema {
    const propertiesCount = this.chance.integer({
      min: this.minProperties,
      max: this.maxProperties,
    });
    this.debug(
      `Making an object schema named ${inspect(
        name,
      )} with ${propertiesCount} properties`,
    );
    const propertyNames = this.chance.unique(
      this.makePropertyName,
      propertiesCount,
    );
    const properties: { [name: string]: Realm.ObjectSchemaProperty } = {};
    for (const propertyName of propertyNames) {
      const property = this.makeProperty(extraTypes);
      this.debug(
        `Adding property named ${inspect(propertyName)} of type ${inspect(
          property.type,
        )}`,
      );
      properties[propertyName] = property;
    }
    const keyableProperyNames = Object.keys(properties).filter(n => {
      const property = properties[n] as Realm.ObjectSchemaProperty;
      return KEYABLE_TYPES.includes(property.type);
    });
    const primaryKey = this.chance.pickone([...keyableProperyNames, undefined]);
    return {
      name,
      properties,
      primaryKey,
    };
  }

  /**
   * Supports modes of ridiculousness:
   * - Nicely formatted "PascalCased" name
   * - Strings from the a-z0-9 + symbols alphabet
   * - Strings from the entire unicode alphabet
   */
  public makeObjectSchemaName = () => {
    if (this.nameRidiculousness === "low") {
      const wordCount = this.chance.integer({ min: 1, max: 3 });
      const words = this.chance.unique(this.chance.word, wordCount);
      return words.map(word => this.chance.capitalize(word)).join("");
    } else if (this.nameRidiculousness === "medium") {
      return this.chance.string();
    } else if (this.nameRidiculousness === "high") {
      return this.generateUnicodeString(false);
    } else {
      throw new Error(
        `Unsupported rediculousness level ${this.nameRidiculousness}`,
      );
    }
  };

  public makePropertyName = () => {
    if (this.nameRidiculousness === "low") {
      const wordCount = this.chance.integer({ min: 1, max: 3 });
      const words = this.chance.unique(this.chance.word, wordCount);
      return words
        .map((word, w) => (w === 0 ? word : this.chance.capitalize(word)))
        .join("");
    } else if (this.nameRidiculousness === "medium") {
      return this.chance.string();
    } else if (this.nameRidiculousness === "high") {
      return this.generateUnicodeString(false);
    } else {
      throw new Error(
        `Unsupported rediculousness level ${this.nameRidiculousness}`,
      );
    }
  };

  public makeProperty(extraTypes: string[] = []): Realm.ObjectSchemaProperty {
    const type = this.chance.pickone([
      "list",
      // 'linkingObjects',
      ...PRIMITIVE_TYPES,
      ...extraTypes,
    ]);

    const property: Realm.ObjectSchemaProperty = {
      indexed: this.chance.bool() && INDEXABLE_TYPES.includes(type),
      optional: this.chance.bool() && type !== "",
      type,
      // mapTo (not stored in the Realm)
      // property (used when type is "linkingObjects", but its not stored in the Realm)
    };
    if (type === "list") {
      // Make it a list of something ..
      this.debug(
        `Picking objectType from ${PRIMITIVE_TYPES} and ${extraTypes}`,
      );
      property.objectType = this.chance.pickone([
        ...PRIMITIVE_TYPES,
        ...extraTypes,
      ]);
    }
    // Make a default value
    property.default = this.makePropertyDefault(property);
    // Ensure list of non-primitives are always "required"
    if (property.type === "list" && !isPrimitive(property.objectType)) {
      property.optional = false;
    }
    return property;
  }

  public makePropertyDefault(property: Realm.ObjectSchemaProperty) {
    const { type, objectType } = property;
    if (
      isPrimitive(type) ||
      (type === "list" && objectType && isPrimitive(objectType))
    ) {
      const hasDefault = this.chance.bool();
      return hasDefault ? this.makeValue(property) : undefined;
    }
  }

  public makeValue(property: Realm.ObjectSchemaProperty): any {
    const { type, objectType } = property;
    if (type === "bool") {
      return this.chance.bool();
    } else if (type === "int") {
      return this.chance.integer();
    } else if (type === "float" || type === "double") {
      return this.chance.floating();
    } else if (type === "string") {
      return this.chance.string();
    } else if (type === "data") {
      const isEmpty = this.chance.bool();
      if (isEmpty) {
        return new ArrayBuffer(0);
      } else {
        const length = this.chance.integer({ min: 1, max: this.maxDataSize });
        const buffer = new Int32Array(length);
        for (let i = 0; i < buffer.byteLength; i++) {
          buffer[i] = this.chance.integer();
        }
        return buffer;
      }
    } else if (type === "date") {
      return this.chance.date();
    } else if (type === "list" && objectType) {
      const isEmpty = this.chance.bool();
      if (isEmpty) {
        return [];
      } else {
        const elementCount = this.chance.integer({
          min: 1,
          max: this.maxListElements,
        });
        const list: any = [];
        for (let i = 0; i < elementCount; i++) {
          const element = this.makeValue({ type: objectType });
          // If we cannot make a value of the objectType - just return the empty list
          if (element === null) {
            return list;
          } else {
            list.push(element);
          }
        }
        return list;
      }
    } else if (this.realm) {
      // Determine if this is a valid object schema
      const objectSchemaName = type === "object" ? property.objectType : type;
      const objectSchema = this.realm.schema.find(
        s => s.name === objectSchemaName,
      );
      // If we found an object schema with this particular name
      if (objectSchema) {
        // Determine if this should have a value and there are objects to pick from
        const objects = this.realm.objects(objectSchema.name);
        const hasValue = this.chance.bool();
        if (hasValue && objects.length > 0) {
          // Pick an existing object
          const index = this.chance.integer({
            min: 0,
            max: objects.length - 1,
          });
          return objects[index];
        } else {
          return null;
        }
      }
    }
    throw new Error(`Cannot make value of ${inspect(property)}`);
  }

  public makeObjects() {
    if (this.realm) {
      const objectSchemasWithObjects = this.realm.schema
        .filter(() => {
          return this.chance.bool({ likelihood: 80 }); // 80% likely to have objects
        })
        .map(schema => schema.name);
      // Return if no object schemas are supposed to have objects
      if (objectSchemasWithObjects.length === 0) {
        return;
      }
      const objectCount = this.chance.integer({
        min: 0,
        max: this.maxObjectCount,
      });
      this.debug(`Creating ${objectCount} objects`);
      this.realm.beginTransaction();
      for (let o = 0; o < objectCount; o++) {
        // Commit and begin a new transaction - at a 10% chance
        if (this.chance.bool({ likelihood: 10 })) {
          this.realm.commitTransaction();
          this.realm.beginTransaction();
        }
        const objectSchemaName = this.chance.pickone(objectSchemasWithObjects);
        const properties = this.makeObjectProperties(objectSchemaName);
        const propertiesString = inspect(properties, false, 0);
        this.debug(`Creating "${objectSchemaName}" object ${propertiesString}`);
        this.realm.create(objectSchemaName, properties);
      }
      // Commit if we're in a transaction
      if (this.realm.isInTransaction) {
        this.realm.commitTransaction();
      }
    } else {
      throw new Error("A Realm needs to be open");
    }
  }

  public makeObjectProperties(objectSchemaName: string) {
    if (this.realm) {
      const objectSchema = this.realm.schema.find(
        s => s.name === objectSchemaName,
      );
      if (objectSchema) {
        const properties: { [k: string]: any } = {};
        for (const p of Object.keys(objectSchema.properties)) {
          const property = objectSchema.properties[p];
          properties[p] = this.makeValue(
            // We know this is a ObjectSchemaProperty as its read from the Realm
            property as Realm.ObjectSchemaProperty,
          );
        }
        return properties;
      } else {
        throw new Error(`Unknown object schema named "${objectSchemaName}"`);
      }
    } else {
      throw new Error("A Realm needs to be open");
    }
  }

  private generateUnicodeString(allowEmpty = true, allowNulls = true) {
    const length = this.chance.integer({
      min: allowEmpty ? 0 : 1,
      max: this.maxUnicodeString,
    });
    const buffer = new Buffer(length);
    for (let i = 0; i < buffer.byteLength; i++) {
      buffer[i] = this.chance.integer({
        min: allowNulls ? 0x00 : 0x01,
        max: 0xff,
      });
    }
    return buffer.toString("utf8");
  }
}
