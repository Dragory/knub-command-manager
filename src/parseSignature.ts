import { IParameter, TOption, TSignature, TTypeConverterFn } from "./types";
import { defaultTypeConverters } from "./defaultTypes";

const paramDefinitionSimpleRegex = /[<\[].*?[>\]]/g;

const paramDefinitionRegex = new RegExp(
  "[<\\[]" +
  "([a-z0-9]+?)" + // (1) Argument name
  "(?:\\:([a-z]+?))?" + // (2) Argument type
  "(?:=(.+?))?" + // (3) Default value
  "(\\.\\.\\.)?" + // (4) "..." to mark argument as a rest argument
  "(\\$)?" + // (5) "$" to mark the argument as a "catch-all" for the rest of the arguments (will be returned as the full string, unlike "...")
    "[>\\]]",
  "i",
);

export function parseSignature<TContext = any>(
  str: string,
  types: Record<string, TTypeConverterFn<TContext>> = defaultTypeConverters,
  defaultType = "string",
): TSignature<TContext> {
  if (!types[defaultType]) {
    throw new Error(`Default type does not exist: ${defaultType}`);
  }

  const chars = [...str];
  const result: TSignature<TContext> = {};

  let currentItem: "parameter" | "option" | null = null;
  let currentOption: Partial<TOption<TContext>> = {};
  let currentParameter: Partial<IParameter<TContext>> = {};
  let currentName = "";

  let state: "name" | "type" | "value" | null = null;
  let currentLiteral = "";
  let quoted = false;

  const flush = () => {
    if (currentLiteral === "") {
      return;
    }

    if (state === "name") {
      currentName = currentLiteral;
    } else if (state === "type") {
      if (!types[currentLiteral]) {
        throw new Error(`Unknown type: ${currentLiteral}`);
      }

      if (currentItem === "parameter") currentParameter.type = types[currentLiteral];
      else if (currentItem === "option") currentOption.type = types[currentLiteral];
    } else if (state === "value") {
      if (currentItem === "parameter") currentParameter.def = currentLiteral;
      else if (currentItem === "option") currentOption.def = currentLiteral;
    } else {
      throw new Error("Can't flush from empty state");
    }

    currentLiteral = "";
  };

  const saveCurrentParameter = () => {
    result[currentName] = {
      option: false,
      type: types[defaultType],
      ...currentParameter,
    };

    currentParameter = {};
    currentName = "";
    currentItem = null;
    state = null;
  };

  const saveCurrentOption = () => {
    result[currentName] = {
      option: true,
      type: defaultTypeConverters.bool,
      isSwitch: true,
      ...currentOption,
    };

    currentOption = {};
    currentName = "";
    currentItem = null;
    state = null;
  };

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === '"' || char === "'") {
      quoted = !quoted;
    } else if (quoted) {
      currentLiteral += char;
    } else if (char === "<") {
      state = "name";
      currentItem = "parameter";
      currentParameter.required = true;
    } else if (char === "[") {
      state = "name";
      currentItem = "parameter";
      currentParameter.required = false;
    } else if (char === "-") {
      state = "name";
      currentItem = "option";
    } else if (char === ":") {
      flush();
      state = "type";

      // If an option has a type, it's not a switch
      if (currentItem === "option") {
        currentOption.isSwitch = false;
      }
    } else if (char === "=") {
      flush();
      state = "value";
    } else if (char === "$") {
      flush();
      currentParameter.catchAll = true;
    } else if (char === "." && chars.slice(i, i + 3).join("") === "...") {
      flush();
      currentParameter.rest = true;
      i += 2; // +1 from loop
    } else if (char.match(/\s/)) {
      if (currentItem === "option") {
        flush();
        saveCurrentOption();
      } else if (currentItem === "parameter") {
        currentLiteral += char;
      }
    } else if (char === ">" || char === "]") {
      flush();
      saveCurrentParameter();
    } else {
      currentLiteral += char;
    }
  }

  if (currentItem === "option") {
    flush();
    saveCurrentOption();
  } else if (currentItem === "parameter") {
    throw new Error(`Unterminated parameter at the end of '${str}'`);
  }

  return result;
}

export function _parseParameters<TContext = any>(
  str: string,
  types: Record<string, TTypeConverterFn<TContext>> = defaultTypeConverters,
  defaultType = "string",
): Record<string, IParameter<TContext>> {
  const parameterDefinitions = str.match(paramDefinitionSimpleRegex) || [];

  return parameterDefinitions.reduce((parameters, parameterDefinition, i) => {
    const details = parameterDefinition.match(paramDefinitionRegex);
    if (!details) {
      throw new Error(`Invalid parameter definition: ${parameterDefinition}`);
    }

    let defaultValue: any = details[3];
    const isRest = details[4] === "...";
    const isOptional = parameterDefinition[0] === "[" || defaultValue != null;
    const isCatchAll = details[5] === "$";

    if (isRest) {
      defaultValue = [];
    }

    const typeName = details[2] || defaultType;
    if (types[typeName] == null) {
      throw new Error(`Unknown parameter type: ${typeName}`);
    }

    parameters[details[1]] = {
      type: types[typeName],
      required: !isOptional,
      def: defaultValue,
      rest: isRest,
      catchAll: isCatchAll,
    };

    return parameters;
  }, {});
}
