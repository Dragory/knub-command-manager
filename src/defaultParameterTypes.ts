import { TypeConverterFn } from "./types";
import { TypeConversionError } from "./TypeConversionError";

export const defaultParameterTypes: { [key: string]: TypeConverterFn } = {
  string(value): string {
    return String(value);
  },

  number(value): number {
    if (isNaN(value)) throw new TypeConversionError(`Value is not a number`);
    return parseFloat(value);
  },

  bool(value): boolean {
    return value === "true" || value === "1";
  }
};
