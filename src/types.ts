export interface CommandManagerOptions {
    prefix: RegExp | string;
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
}

export interface ArgumentMap {
    [name: string]: Argument;
}

// Options
export type BaseOption = { name: string, shortcut?: string };
export type OptionWithValue = BaseOption & { type?: string, required?: boolean };
export type FlagOption = BaseOption & { flag: true };
export type CommandOption = OptionWithValue | FlagOption;

export interface MatchedOption {
    option: CommandOption;
    value: any;
}

export interface MatchedOptionMap {
    [name: string]: MatchedOption;
}

// Commands
export type FilterFn = (command: MatchedCommand) => boolean | Promise<boolean>;

export interface CommandConfig {
    options?: CommandOption[];
    aliases?: string[];
    overloads?: Array<string | Parameter[]>;
    filters?: FilterFn[];
}

export interface CommandDefinition<T extends CommandConfig = CommandConfig> {
    triggerRegex: RegExp;
    parameters: Parameter[];
    config?: T;
}

export interface MatchedCommand extends CommandDefinition {
    args: ArgumentMap;
    opts: MatchedOptionMap;
}

export type TypeConverterFn = (value: any) => any;
