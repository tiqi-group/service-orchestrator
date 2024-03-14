type AttributeType =
  | null
  | "str"
  | "bool"
  | "float"
  | "int"
  | "Quantity"
  | "list"
  | "method"
  | "DataService"
  | "DeviceConnection"
  | "Enum"
  | "NumberSlider"
  | "Image"
  | "ColouredEnum";

type ValueType = boolean | string | number | Record<string, unknown> | null;
export type SerializedValue = {
  type: AttributeType;
  value?: ValueType | ValueType[];
  readonly: boolean;
  doc?: string | null;
  async?: boolean;
  frontend_render?: boolean;
  enum?: Record<string, string>;
};

class SerializationPathError extends Error {}

export type State = {
  type: string;
  value: Record<string, SerializedValue> | null;
  readonly: boolean;
  doc: string | null;
};

export function setNestedValueByPath(
  serializationDict: Record<string, SerializedValue> | null,
  path: string,
  serializedValue: SerializedValue,
): Record<string, SerializedValue> {
  const parentPathParts = path.split(".").slice(0, -1);
  const attrName = path.split(".").pop();

  if (!attrName) {
    throw new Error("Invalid path");
  }

  let currentSerializedValue: SerializedValue;
  const newSerializationDict: Record<string, SerializedValue> = JSON.parse(
    JSON.stringify(serializationDict),
  );

  let currentDict = newSerializationDict;

  try {
    for (const pathPart of parentPathParts) {
      currentSerializedValue = getNextLevelDictByKey(currentDict, pathPart, false);
      // @ts-expect-error The value will be of type SerializedValue as we are still
      // looping through the parent parts
      currentDict = currentSerializedValue["value"];
    }

    currentSerializedValue = getNextLevelDictByKey(currentDict, attrName, true);

    Object.assign(currentSerializedValue, serializedValue);
    return newSerializationDict;
  } catch (error) {
    console.error(error);
    return currentDict;
  }
}

function getNextLevelDictByKey(
  serializationDict: Record<string, SerializedValue>,
  attrName: string,
  allowAppend: boolean = false,
): SerializedValue {
  const [key, index] = parseListAttrAndIndex(attrName);

  try {
    if (index !== null) {
      if (!serializationDict[key] || !Array.isArray(serializationDict[key].value)) {
        throw new SerializationPathError(
          `Expected an array at '${key}', but found something else.`,
        );
      }
      const valueArray = serializationDict[key].value as SerializedValue[];

      if (index < valueArray.length) {
        return valueArray[index];
      } else if (allowAppend && index === valueArray.length) {
        valueArray.push({ value: null, type: null, doc: null, readonly: false });
        return valueArray[index];
      } else {
        throw new SerializationPathError(`Index out of range for '${key}[${index}]'.`);
      }
    } else {
      if (!serializationDict[key]) {
        throw new SerializationPathError(`Key '${key}' not found.`);
      }
      return serializationDict[key];
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Error occurred trying to access '${attrName}': ${error.message}`,
      );
    } else {
      throw error; // Rethrow if it's not an Error instance, which shouldn't happen in this context
    }
  }
}

function parseListAttrAndIndex(attrString: string): [string, number | null] {
  let index: number | null = null;
  let attrName = attrString;

  if (attrString.includes("[") && attrString.endsWith("]")) {
    const parts = attrString.split("[");
    attrName = parts[0];
    const indexPart = parts[1].slice(0, -1); // Removes the closing ']'

    if (!isNaN(parseInt(indexPart))) {
      index = parseInt(indexPart);
    } else {
      console.error(`Invalid index format in key: ${attrString}`);
    }
  }

  return [attrName, index];
}
