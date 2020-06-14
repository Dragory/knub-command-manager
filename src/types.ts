export interface ICommandManagerOptions<TContext> {
  prefix?: RegExp | string;
  optionPrefixes?: string[];
}

// Parameters
export interface IParameter<TContext> {
  type: TTypeConverterFn<TContext>;
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
  type: TTypeConverterFn<TContext>;
  isSwitch?: boolean;
  def?: any;
};

export type TSignature<TContext> = Record<string, IParameter<TContext> | TOption<TContext>>;

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

export type TTypeConverterFn<TContext> = ((value: any) => any) | ((value: any, context: TContext) => any);
