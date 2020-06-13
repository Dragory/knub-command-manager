import { IParameter, TTypeConverterFn } from "./types";
import { TypeConversionError } from "./TypeConversionError";

export const defaultTypeConverters: Record<string, TTypeConverterFn<any>> = {
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

export type TTypeHelperResult<T> = T & { type: TTypeConverterFn<any> };
export type TTypeHelper = <T>(opts?: T) => T & { type: TTypeConverterFn<any> };

export const string: TTypeHelper = <T>(opts?: T) => {
  return {
    ...(opts || {}),
    type: defaultTypeConverters.string
  } as TTypeHelperResult<T>;
};

export const number: TTypeHelper = <T>(opts?: T) => {
  return {
    ...opts,
    type: defaultTypeConverters.number
  } as TTypeHelperResult<T>;
};

export const bool: TTypeHelper = <T>(opts?: T) => {
  return {
    ...opts,
    type: defaultTypeConverters.bool
  } as TTypeHelperResult<T>;
};
