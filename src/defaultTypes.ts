import { IParameter, TTypeConverterFn } from "./types";
import { TypeConversionError } from "./TypeConversionError";

export const defaultTypeConverters = {
  string(value, context): string {
    return String(value);
  },

  number(value, context): number {
    if (isNaN(value)) throw new TypeConversionError(`Value is not a number`);
    return parseFloat(value);
  },

  bool(value, context): boolean {
    return value === "true" || value === "1";
  },
};

export type TTypeHelperResult<TInput, TType> = TInput & { type: TTypeConverterFn<TType, any> };

export const string = <T>(opts?: T) => {
  return {
    ...(opts || {}),
    type: defaultTypeConverters.string,
  } as TTypeHelperResult<T, string>;
};

export const number = <T>(opts?: T) => {
  return {
    ...opts,
    type: defaultTypeConverters.number,
  } as TTypeHelperResult<T, number>;
};

export const bool = <T>(opts?: T) => {
  return {
    ...opts,
    type: defaultTypeConverters.bool,
  } as TTypeHelperResult<T, boolean>;
};

export const switchOption = <T>(opts?: T) => {
  return {
    ...opts,
    option: true,
    isSwitch: true,
    type: defaultTypeConverters.bool,
  } as TTypeHelperResult<T, boolean>;
};
