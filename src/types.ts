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
}

export type TSignature<TContext> = Record<string, IParameter<TContext>>;

// Arguments
export interface IArgument<TContext> {
  parameter: IParameter<TContext>;
  value: any;
  usesDefaultValue?: true;
}

export interface IArgumentMap<TContext> {
  [name: string]: IArgument<TContext>;
}

// Options
export type TBaseOption = { name: string; shortcut?: string };
export type TOptionWithValue<TContext> = TBaseOption & {
  type: TTypeConverterFn<TContext>;
  required?: boolean;
  def?: any;
  isSwitch?: false;
};
export type TSwitchOption = TBaseOption & { isSwitch: true };
export type TOption<TContext> = TOptionWithValue<TContext> | TSwitchOption;

export function isSwitchOption(option: TOption<any>): option is TSwitchOption {
  return option.isSwitch === true;
}

export interface IMatchedOption<TContext> {
  option: TOption<TContext>;
  value: any;
  usesDefaultValue?: true;
}

export interface IMatchedOptionMap<TContext> {
  [name: string]: IMatchedOption<TContext>;
}

// Commands
export type TPreFilterFn<TContext, TExtra> = (
  command: ICommandDefinition<TContext, TExtra>,
  context: TContext
) => boolean | Promise<boolean>;
export type TPostFilterFn<TContext, TExtra> = (
  command: IMatchedCommand<TContext, TExtra>,
  context: TContext
) => boolean | Promise<boolean>;

export interface ICommandConfig<TContext, TExtra> {
  prefix?: string | RegExp;
  options?: TOption<TContext>[];
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
  options: TOption<TContext>[];
  preFilters: TPreFilterFn<TContext, TExtra>[];
  postFilters: TPostFilterFn<TContext, TExtra>[];
  config: ICommandConfig<TContext, TExtra> | null;
}

// Relevant: https://github.com/Microsoft/TypeScript/issues/12815
export type TError = { error: string };
export type TOrError<T> = T | TError;

export function isError(value: TOrError<any>): value is TError {
  return value.error != null;
}

export interface ITryMatchingCommandResult<TContext, TExtra> {
  command: IMatchedCommand<TContext, TExtra>;
}

export interface IMatchedSignature<TContext> {
  args: IArgumentMap<TContext>;
  opts: IMatchedOptionMap<TContext>;
}

export interface IMatchedCommand<TContext, TExtra> extends ICommandDefinition<TContext, TExtra> {
  args: IArgumentMap<TContext>;
  opts: IMatchedOptionMap<TContext>;
  error?: never;
}

export interface IFindMatchingCommandError<TContext, TExtra> {
  error: string;
  command: ICommandDefinition<TContext, TExtra>;
}

export type TFindMatchingCommandResult<TContext, TExtra> =
  | IMatchedCommand<TContext, TExtra>
  | IFindMatchingCommandError<TContext, TExtra>;

export function findMatchingCommandResultHasError<TContext, TExtra>(
  result: TFindMatchingCommandResult<TContext, TExtra>
): result is IFindMatchingCommandError<TContext, TExtra> {
  return result.error != null;
}

export type TTypeConverterFn<TContext> = ((value: any) => any) | ((value: any, context: TContext) => any);
