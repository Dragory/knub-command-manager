export interface CommandManagerOptions {
  prefix?: RegExp | string;
  types?: { [key: string]: TypeConverterFn };
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
export type PreFilterFn<TContext> = (
  command: CommandDefinition<TContext>,
  context: TContext
) => boolean | Promise<boolean>;
export type PostFilterFn<TContext> = (
  command: MatchedCommand<TContext>,
  context: TContext
) => boolean | Promise<boolean>;

export interface CommandConfig<TContext> {
  prefix?: string | RegExp;
  options?: CommandOption[];
  aliases?: string[];
  preFilters?: PreFilterFn<TContext>[];
  postFilters?: PostFilterFn<TContext>[];
}

export interface CommandDefinition<TContext> {
  id: number;
  prefix: RegExp | null;
  triggers: RegExp[];
  parameters: Parameter[];
  options: CommandOption[];
  preFilters: PreFilterFn<TContext>[];
  postFilters: PostFilterFn<TContext>[];
}

// https://github.com/Microsoft/TypeScript/issues/12815
export type CommandMatchResultSuccess<TContext> = { command: MatchedCommand<TContext>; error?: undefined };
export type CommandMatchResultError = { error: string; command?: undefined };
export type CommandMatchResult<TContext> = CommandMatchResultSuccess<TContext> | CommandMatchResultError;

export interface MatchedCommand<TContext> extends CommandDefinition<TContext> {
  args: ArgumentMap;
  opts: MatchedOptionMap;
  error?: undefined;
}

export type TypeConverterFn = (value: any) => any;
