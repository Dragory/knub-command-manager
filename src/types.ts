export interface ICommandManagerOptions<TContext> {
  prefix?: RegExp | string;
  optionPrefixes?: string[];
}

// Parameters
export interface IParameter<TContext> {
  type: TTypeConverterFn<any, TContext>;
  required?: boolean;
  def?: any;
  rest?: boolean;
  catchAll?: boolean;
  option?: false;
}

// Options
export type TOption<TContext> = {
  option: true;
  shortcut?: string;
  type: TTypeConverterFn<any, TContext>;
  isSwitch?: boolean;
  def?: any;
};

/**
 * A signature - a set of parameters - for a command
 *
 * `undefined` is included as an allowed value here because if you have an array of signature objects,
 * TypeScript will interpret that array's type as being an array of a union of each signature within that array,
 * with each of those signatures having the other signatures' properties that they don't have as optional properties.
 * E.g. `[{foo: 5}, {bar: "text"}]` would have the type `({foo: number, bar?: undefined} | {foo?: undefined, bar: string})[]`
 * If you then wanted to pass this type to a generic that expects an array of TSignatures, it would be rejected because
 * of the optional properties with `undefined` as their type. Including `undefined` here fixes this.
 */
export type TSignature<TContext> = Record<string, IParameter<TContext> | TOption<TContext> | undefined>;
export type TSafeSignature<TContext> = Record<string, IParameter<TContext> | TOption<TContext>>;

// Matched arguments
export interface IMatchedArgument<TContext> {
  parameter: IParameter<TContext>;
  value: any;
  usesDefaultValue?: true;
}

// Matched options
export interface IMatchedOption<TContext> {
  option: TOption<TContext>;
  value: any;
  usesDefaultValue?: true;
}

export type IMatchedSignature<TContext> = Record<string, IMatchedArgument<TContext> | IMatchedOption<TContext>>;

export function isMatchedArgument(value: IMatchedArgument<any> | IMatchedOption<any>): value is IMatchedArgument<any> {
  return (value as any).parameter != null;
}

// Filters
export type TPreFilterFn<TContext, TExtra> = (
  command: ICommandDefinition<TContext, TExtra>,
  context: TContext,
) => boolean | Promise<boolean>;
export type TPostFilterFn<TContext, TExtra> = (
  command: IMatchedCommand<TContext, TExtra>,
  context: TContext,
) => boolean | Promise<boolean>;

// Command data
export interface ICommandConfig<TContext, TExtra> {
  prefix?: string | RegExp;
  preFilters?: TPreFilterFn<TContext, TExtra>[];
  postFilters?: TPostFilterFn<TContext, TExtra>[];
  extra?: TExtra;
}

export interface ICommandDefinition<TContext, TExtra> {
  id: number;
  prefix: RegExp | null;
  originalPrefix: string | RegExp | null;
  triggers: RegExp[];
  originalTriggers: Array<string | RegExp>;
  signatures: TSignature<TContext>[];
  preFilters: TPreFilterFn<TContext, TExtra>[];
  postFilters: TPostFilterFn<TContext, TExtra>[];
  config: ICommandConfig<TContext, TExtra> | null;
}

// Relevant: https://github.com/Microsoft/TypeScript/issues/12815
export type TBaseError = { error: string };
export type TOrError<T, TError extends TBaseError = TBaseError> = T | TError;

export function isError(value: TOrError<any>): value is TBaseError {
  return value.error != null;
}

export interface IMatchedCommand<TContext, TExtra> extends ICommandDefinition<TContext, TExtra> {
  values: IMatchedSignature<TContext>;
  error?: never;
}

export interface IFindMatchingCommandError<TContext, TExtra> extends TBaseError {
  command: ICommandDefinition<TContext, TExtra>;
}

export type TTypeConverterFn<TReturnType, TContext> =
  | ((value: any) => TReturnType)
  | ((value: any, context: TContext) => TReturnType);
