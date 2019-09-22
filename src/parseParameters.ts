import { IParameter } from "./types";

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

export function parseParameters(str: string): IParameter[] {
  const parameterDefinitions = str.match(paramDefinitionSimpleRegex) || [];

  return parameterDefinitions.map(
    (parameterDefinition, i): IParameter => {
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

      return {
        name: details[1],
        type: details[2] || "string",
        required: !isOptional,
        def: defaultValue,
        rest: isRest,
        catchAll: isCatchAll
      };
    }
  );
}
