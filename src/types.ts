export interface ICommandManagerOptions<TContext> {
  prefix?: RegExp | string;
  types?: { [key: string]: TTypeConverterFn<TContext> };
  defaultType?: string;
  optionPrefixes?: string[];
}

// Parameters
export interface IParameter {
  name: string;
  type: string;
  required?: boolean;
  def?: any;
  rest?: boolean;
  catchAll?: boolean;
}

export type TSignature = IParameter[];
export type TParseableSignature = string | TSignature;

// Arguments
export interface IArgument {
  parameter: IParameter;
  value: any;
  usesDefaultValue?: true;
}

export interface IArgumentMap {
  [name: string]: IArgument;
}

// Options
export type TBaseOption = { name: string; shortcut?: string };
export type TOptionWithValue = TBaseOption & { type?: string; required?: boolean; def?: any; isSwitch?: false };
export type TSwitchOption = TBaseOption & { isSwitch: true };
export type TOption = TOptionWithValue | TSwitchOption;

export function isSwitchOption(option: TOption): option is TSwitchOption {
  return option.isSwitch === true;
}

export interface IMatchedOption {
  option: TOption;
  value: any;
  usesDefaultValue?: true;
}

export interface IMatchedOptionMap {
  [name: string]: IMatchedOption;
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
  options?: TOption[];
  aliases?: string[];
  overloads?: TParseableSignature[];
  preFilters?: TPreFilterFn<TContext, TExtra>[];
  postFilters?: TPostFilterFn<TContext, TExtra>[];
  extra?: TExtra;
}

export interface ICommandDefinition<TContext, TExtra> {
  id: number;
  prefix: RegExp | null;
  triggers: RegExp[];
  originalTriggers: Array<string | RegExp>;
  signatures: TSignature[];
  options: TOption[];
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

export interface ITryMatchingArgumentsToSignatureResult {
  args: IArgumentMap;
  opts: IMatchedOptionMap;
}

export interface IMatchedCommand<TContext, TExtra> extends ICommandDefinition<TContext, TExtra> {
  args: IArgumentMap;
  opts: IMatchedOptionMap;
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
