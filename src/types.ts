export interface CommandManagerOptions<TContext> {
  prefix?: RegExp | string;
  types?: { [key: string]: TypeConverterFn<TContext> };
  defaultType?: string;
}

// Parameters
export interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  def?: any;
  rest?: boolean;
  catchAll?: boolean;
}

// Arguments
export interface Argument {
  parameter: Parameter;
  value: any;
  usesDefaultValue?: true;
}

export interface ArgumentMap {
  [name: string]: Argument;
}

// Options
export type BaseOption = { name: string; shortcut?: string };
export type OptionWithValue = BaseOption & { type?: string; required?: boolean; def?: any; flag?: false };
export type FlagOption = BaseOption & { flag: true };
export type CommandOption = OptionWithValue | FlagOption;

export interface MatchedOption {
  option: CommandOption;
  value: any;
  usesDefaultValue?: true;
}

export interface MatchedOptionMap {
  [name: string]: MatchedOption;
}

// Commands
export type PreFilterFn<TContext, TExtra> = (
  command: CommandDefinition<TContext, TExtra>,
  context: TContext
) => boolean | Promise<boolean>;
export type PostFilterFn<TContext, TExtra> = (
  command: MatchedCommand<TContext, TExtra>,
  context: TContext
) => boolean | Promise<boolean>;

export type CommandConfig<TContext, TExtra> = {
  prefix?: string | RegExp;
  options?: CommandOption[];
  aliases?: string[];
  preFilters?: PreFilterFn<TContext, TExtra>[];
  postFilters?: PostFilterFn<TContext, TExtra>[];
  extra?: TExtra;
};

export type CommandDefinition<TContext, TExtra> = {
  id: number;
  prefix: RegExp | null;
  triggers: RegExp[];
  parameters: Parameter[];
  options: CommandOption[];
  preFilters: PreFilterFn<TContext, TExtra>[];
  postFilters: PostFilterFn<TContext, TExtra>[];
  config: CommandConfig<TContext, TExtra> | null;
};

// https://github.com/Microsoft/TypeScript/issues/12815
export type CommandMatchResultSuccess<TContext, TExtra> = {
  command: MatchedCommand<TContext, TExtra>;
  error?: undefined;
};
export type CommandMatchResultError = { error: string };
export type CommandMatchResult<TContext, TExtra> =
  | CommandMatchResultSuccess<TContext, TExtra>
  | CommandMatchResultError;

export interface MatchedCommand<TContext, TExtra> extends CommandDefinition<TContext, TExtra> {
  args: ArgumentMap;
  opts: MatchedOptionMap;
  error?: undefined;
}

export type TypeConverterFn<TContext> = ((value: any) => any) | ((value: any, context: TContext) => any);

export interface FindMatchingCommandError<TContext, TExtra> {
  error: string;
  command: CommandDefinition<TContext, TExtra>;
}
