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
export type PreFilterFn<TCustomProps> = (command: CommandDefinition<TCustomProps>) => boolean | Promise<boolean>;
export type PostFilterFn<TCustomProps> = (command: MatchedCommand<TCustomProps>) => boolean | Promise<boolean>;

export interface CommandConfig<TCustomProps> {
  prefix?: string | RegExp;
  options?: CommandOption[];
  aliases?: string[];
  preFilters?: PreFilterFn<TCustomProps>[];
  postFilters?: PostFilterFn<TCustomProps>[];
}

export interface CommandDefinition<TCustomProps> {
  prefix: RegExp | null;
  triggers: RegExp[];
  parameters: Parameter[];
  options: CommandOption[];
  preFilters: PreFilterFn<TCustomProps>[];
  postFilters: PostFilterFn<TCustomProps>[];
  customProps?: TCustomProps;
}

// https://github.com/Microsoft/TypeScript/issues/12815
export type CommandMatchResultSuccess<TCustomProps> = { command: MatchedCommand<TCustomProps>; error?: undefined };
export type CommandMatchResultError = { error: string; command?: undefined };
export type CommandMatchResult<TCustomProps> = CommandMatchResultSuccess<TCustomProps> | CommandMatchResultError;

export interface MatchedCommand<TCustomProps> extends CommandDefinition<TCustomProps> {
  args: ArgumentMap;
  opts: MatchedOptionMap;
  error?: undefined;
}

export type TypeConverterFn = (value: any) => any;
