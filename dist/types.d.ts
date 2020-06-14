export interface ICommandManagerOptions<TContext> {
  prefix?: RegExp | string;
  optionPrefixes?: string[];
}
export interface IParameter<TContext> {
  type: TTypeConverterFn<any, TContext>;
  required?: boolean;
  def?: any;
  rest?: boolean;
  catchAll?: boolean;
  option?: false;
}
export declare type TOption<TContext> = {
  option: true;
  shortcut?: string;
  type: TTypeConverterFn<any, TContext>;
  isSwitch?: boolean;
  def?: any;
};
export declare type TSignature<TContext> = Record<string, IParameter<TContext> | TOption<TContext>>;
export interface IMatchedArgument<TContext> {
  parameter: IParameter<TContext>;
  value: any;
  usesDefaultValue?: true;
}
export interface IMatchedOption<TContext> {
  option: TOption<TContext>;
  value: any;
  usesDefaultValue?: true;
}
export declare type IMatchedSignature<TContext> = Record<string, IMatchedArgument<TContext> | IMatchedOption<TContext>>;
export declare function isMatchedArgument(
  value: IMatchedArgument<any> | IMatchedOption<any>,
): value is IMatchedArgument<any>;
export declare type TPreFilterFn<TContext, TExtra> = (
  command: ICommandDefinition<TContext, TExtra>,
  context: TContext,
) => boolean | Promise<boolean>;
export declare type TPostFilterFn<TContext, TExtra> = (
  command: IMatchedCommand<TContext, TExtra>,
  context: TContext,
) => boolean | Promise<boolean>;
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
export declare type TBaseError = {
  error: string;
};
export declare type TOrError<T, TError extends TBaseError = TBaseError> = T | TError;
export declare function isError(value: TOrError<any>): value is TBaseError;
export interface IMatchedCommand<TContext, TExtra> extends ICommandDefinition<TContext, TExtra> {
  values: IMatchedSignature<TContext>;
  error?: never;
}
export interface IFindMatchingCommandError<TContext, TExtra> extends TBaseError {
  command: ICommandDefinition<TContext, TExtra>;
}
export declare type TTypeConverterFn<TReturnType, TContext> =
  | ((value: any) => TReturnType)
  | ((value: any, context: TContext) => TReturnType);
