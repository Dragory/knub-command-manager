import { IParameter, TTypeConverterFn } from "./types";
import { defaultParameterTypes } from "./defaultParameterTypes";

const paramDefinitionSimpleRegex = /[<\[].*?[>\]]/g;

const paramDefinitionRegex = new RegExp(
  "[<\\[]" +
  "([a-z0-9]+?)" + // (1) Argument name
  "(?:\\:([a-z]+?))?" + // (2) Argument type
  "(?:=(.+?))?" + // (3) Default value
  "(\\.\\.\\.)?" + // (4) "..." to mark argument as a rest argument
  "(\\$)?" + // (5) "$" to mark the argument as a "catch-all" for the rest of the arguments (will be returned as the full string, unlike "...")
    "[>\\]]",
  "i"
);

export function parseParameters<TContext = any>(
  str: string,
  types: Record<string, TTypeConverterFn<TContext>> = defaultParameterTypes,
  defaultType = "string"
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
      catchAll: isCatchAll
    };

    return parameters;
  }, {});
}
