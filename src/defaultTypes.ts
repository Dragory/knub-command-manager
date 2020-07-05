import { IParameter, TOption, TTypeConverterFn } from "./types";
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
export type TTypeHelperOpts = Omit<IParameter<any>, "type"> | Omit<TOption<any>, "type">;

export function createTypeHelper<TReturnType>(converterFn: TTypeConverterFn<TReturnType, any>) {
  return <T extends TTypeHelperOpts>(opts?: T) => {
    return {
      ...(opts || {}),
      type: converterFn,
    } as TTypeHelperResult<T, TReturnType>;
  };
}

export const string = createTypeHelper<string>(defaultTypeConverters.string);
export const number = createTypeHelper<number>(defaultTypeConverters.number);
export const bool = createTypeHelper<boolean>(defaultTypeConverters.bool);

type TSwitchOptionOpts = Omit<TOption<any>, "option" | "isSwitch" | "type">;
export const switchOption = <T extends TSwitchOptionOpts>(opts?: T) => {
  return {
    ...opts,
    option: true,
    isSwitch: true,
    type: defaultTypeConverters.bool,
  } as TTypeHelperResult<T, boolean> & { option: true; isSwitch: true };
};
