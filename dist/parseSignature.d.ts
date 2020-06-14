import { TSignature, TTypeConverterFn } from "./types";
export declare function parseSignature<TContext = any>(
  str: string,
  types?: Record<string, TTypeConverterFn<any, TContext>>,
  defaultType?: string,
): TSignature<TContext>;
