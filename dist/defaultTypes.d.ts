import { TTypeConverterFn } from "./types";
export declare const defaultTypeConverters: {
  string(value: any, context: any): string;
  number(value: any, context: any): number;
  bool(value: any, context: any): boolean;
};
export declare type TTypeHelperResult<TInput, TType> = TInput & {
  type: TTypeConverterFn<TType, any>;
};
export declare function createTypeHelper<TReturnType>(
  converterFn: TTypeConverterFn<TReturnType, any>,
): <T>(opts?: T | undefined) => TTypeHelperResult<T, TReturnType>;
export declare const string: <T>(opts?: T | undefined) => TTypeHelperResult<T, string>;
export declare const number: <T>(opts?: T | undefined) => TTypeHelperResult<T, number>;
export declare const bool: <T>(opts?: T | undefined) => TTypeHelperResult<T, boolean>;
export declare const switchOption: <T>(
  opts?: T | undefined,
) => T & {
  type: TTypeConverterFn<boolean, any>;
} & {
  option: true;
  isSwitch: true;
};
