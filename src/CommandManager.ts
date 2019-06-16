import escapeStringRegex from "escape-string-regexp";
import {
    Argument,
    ArgumentMap,
    CommandConfig,
    CommandDefinition,
    CommandManagerOptions, FlagOption,
    MatchedCommand, MatchedOptionMap, OptionWithValue,
    Parameter,
    TypeConverterFn
} from "./types";
import { defaultParameterTypes } from "./defaultParameterTypes";
import { CommandMatchError } from "./CommandMatchError";
import {parseArguments} from "./parseArguments";
import {TypeConversionError} from "./TypeConversionError";

const paramDefinitionSimpleRegex = /[<\[].*?[>\]]/g;

const paramDefinitionRegex = new RegExp(
    "[<\\[]" +
    "([a-z0-9]+?)" + // (1) Argument name
    "(?:\\:([a-z]+?))?" + // (2) Argument type
    "(?:=(.+?))?" + // (3) Default value
    "(\\.\\.\\.)?" + // (4) "..." to mark argument as a rest argument
    "(\\$)?" + // (5) "$" to mark the argument as a "catch-all" for the rest of the arguments (will be returned as the full string, unlike "...")
    "[>\\]]",
    "i"
);

const optMatchRegex = /^--([^\s-]\S*?)(?:=(.+))?$/;
const optShortcutMatchRegex = /^-([^\s-]+)(?:=(.+))?$/;

const defaultParameter: Partial<Parameter> = {
    required: true,
    def: null,
    rest: false,
    catchAll: false
};

export class CommandManager<T extends CommandConfig = CommandConfig> {
    protected commands: CommandDefinition<T>[] = [];

    protected prefixRegex: RegExp;
    protected types: { [key: string]: TypeConverterFn };
    protected defaultType: string;

    constructor(opts: CommandManagerOptions) {
        const prefix = typeof opts.prefix === "string"
            ? new RegExp(escapeStringRegex(opts.prefix), 'i')
            : opts.prefix;
        this.prefixRegex = new RegExp(`^${prefix.source}`, prefix.flags);

        this.types = opts.types || defaultParameterTypes;
        this.defaultType = opts.defaultType || "string";
    }

    /**
     * Adds a command to the manager.
     *
     * Examples:
     *
     * add("add", "<first:number> <second:number>")
     *   Adds a command called "add" with two required arguments.
     *   These arguments are added in an easily-readable string format.
     *
     * add("echo", [{name: "text", type: "string", catchAll: true}])
     *   Adds a command with a required argument "text" that captures the entire rest of the arguments.
     *   These arguments are added in a more programmable, array of objects format.
     *
     * add("mul", "<numbers:number...>")
     *   Adds a command with a required, repeatable argument "numbers".
     */
    public add(
        trigger: string | RegExp,
        parameters: string | Parameter[] = [],
        config?: T
    ): () => void {
        // First check if this command has aliases and/or parameter overloads
        // If it does, add each combination of those as its own command
        if (config) {
            const aliases = [trigger];
            if (config.aliases) aliases.push(...config.aliases);

            const overloads = [parameters];
            if (config.overloads) overloads.push(...config.overloads);

            if (aliases.length > 1 || overloads.length > 1) {
                const strippedConfig = {...config};
                delete strippedConfig.aliases;
                delete strippedConfig.overloads;

                const deleteCmdFns: Array<() => void> = [];
                for (const alias of aliases) {
                    for (const overload of overloads) {
                        deleteCmdFns.push(this.add(alias, overload, strippedConfig));
                    }
                }

                return () => {
                    deleteCmdFns.forEach(fn => fn());
                };
            }
        }

        // Command can either be a plain string or a regex
        // If string, escape it and turn it into regex
        if (typeof trigger === "string") {
            trigger = new RegExp(escapeStringRegex(trigger), "i");
        }

        const triggerRegex = new RegExp(`^${trigger.source}`, trigger.flags);

        // If parameters are provided in string format, parse it
        if (typeof parameters === "string") {
            parameters = this.parseParameterString(parameters);
        } else if (parameters == null) {
            parameters = [];
        }

        parameters = parameters.map(obj => Object.assign({ type: this.defaultType }, defaultParameter, obj));

        // Validate parameters to prevent unsupported behaviour
        let hadOptional = false;
        let hadRest = false;
        let hadCatchAll = false;

        parameters.forEach(param => {
            if (!this.types[param.type]) {
                throw new Error(`Unknown parameter type: ${param.type}`);
            }

            if (!param.required) {
                hadOptional = true;
            } else if (hadOptional) {
                throw new Error(`Optional parameters must come last`);
            }

            if (hadRest) {
                throw new Error(`Rest parameter must come last`);
            }

            if (param.rest) {
                hadRest = true;
            }

            if (hadCatchAll) {
                throw new Error(`CatchAll parameter must come last`);
            }

            if (param.catchAll) {
                hadCatchAll = true;
            }
        });

        // Actually add the command to the manager
        const definition: CommandDefinition<T> = {
            triggerRegex,
            parameters,
            config,
        };

        this.commands.push(definition);

        // Return a function to remove the command
        return () => {
            this.commands.splice(this.commands.indexOf(definition), 1);
        };
    }

    /**
     * Find the first matching command in the given string, if any.
     * This function returns a promise to support async types and filter functions.
     */
    public async findMatchingCommand(str: string): Promise<MatchedCommand|CommandMatchError|null> {
        let onlyErrors = true;
        let lastError: CommandMatchError | null = null;

        for (const command of this.commands) {
            let matchedCommand: MatchedCommand|null;
            try {
                matchedCommand = await this.tryMatchingCommand(command, str);
                onlyErrors = false;
            } catch (e) {
                if (e instanceof CommandMatchError) {
                    lastError = e;
                    continue;
                }

                if (! (e instanceof CommandMatchError)) {
                    throw e;
                }

                lastError = e;
                continue;
            }

            if (matchedCommand === null) continue;

            if (matchedCommand.config && matchedCommand.config.filters) {
                let passed = false;
                for (const filter of matchedCommand.config.filters) {
                    passed = await filter(matchedCommand);
                    if (! passed) break;
                }
                if (! passed) continue;
            }

            return matchedCommand;
        }

        if (onlyErrors && lastError !== null) {
            return lastError;
        }

        return null;
    }

    protected parseParameterString(str: string): Parameter[] {
        const parameterDefinitions = str.match(paramDefinitionSimpleRegex) || [];

        return parameterDefinitions.map(
            (parameterDefinition, i): Parameter => {
                const details = parameterDefinition.match(paramDefinitionRegex);
                if (!details) {
                    throw new Error(`Invalid argument definition: ${parameterDefinition}`);
                }

                let defaultValue: any = details[3];
                const isRest = details[4] === "...";
                const isOptional = parameterDefinition[0] === "[" || defaultValue != null;
                const isCatchAll = details[5] === "$";

                if (isRest) {
                    defaultValue = [];
                }

                return {
                    name: details[1],
                    type: details[2] || "string",
                    required: !isOptional,
                    def: defaultValue,
                    rest: isRest,
                    catchAll: isCatchAll
                };
            }
        );
    }

    protected async tryMatchingCommand(command: CommandDefinition<T>, str: string): Promise<MatchedCommand|null> {
        const prefixMatch = str.match(this.prefixRegex);
        if (! prefixMatch) return null;
        str = str.slice(prefixMatch[0].length);

        const triggerMatch = str.match(command.triggerRegex);
        if (! triggerMatch) return null;
        str = str.slice(triggerMatch[0].length);

        const argStr = str;
        const parsedArguments = parseArguments(argStr);
        const args: ArgumentMap = {};
        const opts: MatchedOptionMap = {};

        // Match command options (--option value / -o value / --option=value / -o=value)
        if (command.config && command.config.options) {
            const temp = Array.from(parsedArguments);
            for (let i = 0; i < temp.length; i++) {
                const arg = temp[i];

                // Full option name with --name value / --name=value
                const optMatch = arg.value.match(optMatchRegex);
                if (optMatch) {
                    const optName = optMatch[1];

                    const opt = command.config.options.find(o => o.name === optName);
                    if (!opt) {
                        throw new CommandMatchError(`Unknown option: --${optName}`, command);
                    }

                    let optValue: string|boolean = optMatch[2];

                    if ((opt as FlagOption).flag) {
                        if (optValue) {
                            throw new CommandMatchError(`Flags can't have values: --${optName}`, command);
                        }
                        optValue = true;
                    } else if (optValue == null) {
                        // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
                        const nextArg = temp[i + 1];
                        if (! nextArg) {
                            throw new CommandMatchError(`No value for option: --${optName}`, command);
                        }

                        optValue = nextArg.value;

                        // Skip next arg in opt parsing (since we just consumed it)
                        i++;

                        // Don't consider the next arg i.e. the now-option-value as an argument anymore
                        parsedArguments.splice(parsedArguments.indexOf(nextArg), 1);
                    }

                    opts[opt.name] = {
                        option: opt,
                        value: optValue
                    };

                    const indexToDelete = parsedArguments.indexOf(arg);
                    if (indexToDelete !== -1) parsedArguments.splice(indexToDelete, 1);
                }

                // Option shortcut with -n value / -n=value
                // Also supports multiple shortcuts (for flags): -abc
                // Or flags + 1 option: -abc value / -abc=value (a and b are flags, c is an option)
                const optShortcutsMatch = arg.value.match(optShortcutMatchRegex);
                if (optShortcutsMatch) {
                    const shortcuts = [...optShortcutsMatch[1]];
                    const lastValue = optShortcutsMatch[2];
                    const optShortcuts = command.config.options.reduce((map, opt) => {
                        if (opt.shortcut) map[opt.shortcut] = opt;
                        return map;
                    }, {});
                    const matchingOpts = shortcuts.map(s => optShortcuts[s]);

                    const unknownOptShortcutIndex = matchingOpts.findIndex(o => o == null);
                    if (unknownOptShortcutIndex !== -1) {
                        throw new CommandMatchError(`Unknown option shortcut: -${shortcuts[unknownOptShortcutIndex]}`, command);
                    }

                    for (let j = 0; j < matchingOpts.length; j++) {
                        const opt = matchingOpts[j];
                        const isLast = (j === matchingOpts.length - 1);
                        if (isLast) {
                            if ((opt as FlagOption).flag) {
                                if (lastValue) {
                                    throw new CommandMatchError(`Flags can't have values: -${opt.shortcut}`, command);
                                }

                                opts[opt.name] = {
                                    option: opt,
                                    value: true
                                };
                            } else {
                                // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
                                const nextArg = temp[i + 1];
                                if (! nextArg) {
                                    throw new CommandMatchError(`No value for option: -${opt.shortcut}`, command);
                                }

                                opts[opt.name] = {
                                    option: opt,
                                    value: nextArg.value
                                };

                                // Skip next arg in opt parsing (since we just consumed it)
                                i++;

                                // Don't consider the next arg i.e. the now-option-value as an argument anymore
                                const indexToDelete = parsedArguments.indexOf(nextArg);
                                if (indexToDelete !== -1) parsedArguments.splice(indexToDelete, 1);
                            }
                        } else {
                            if (! (opt as FlagOption).flag) {
                                throw new CommandMatchError(`No value for option: -${opt.shortcut}`, command);
                            }

                            opts[opt.name] = {
                                option: opt,
                                value: true
                            };
                        }

                    }

                    const indexToDelete = parsedArguments.indexOf(arg);
                    if (indexToDelete !== -1) parsedArguments.splice(indexToDelete, 1);
                }
            }

            // Check for required options
            for (const opt of command.config.options) {
                if ((opt as OptionWithValue).required && opts[opt.name] == null) {
                    throw new CommandMatchError(`Missing required option: --${opt.name}`, command);
                    break;
                }
            }
        }

        const hasRestOrCatchAll = command.parameters.some(p => Boolean(p.rest) || Boolean(p.catchAll));
        if (!hasRestOrCatchAll && parsedArguments.length > command.parameters.length) {
            throw new CommandMatchError(
                `Too many arguments (found ${parsedArguments.length}, expected ${command.parameters.length})`,
                command
            );
        }

        for (const [i, param] of command.parameters.entries()) {
            const parsedArg = parsedArguments[i];
            let value;

            if (param.rest) {
                const restArgs = parsedArguments.slice(i);
                if (param.required && restArgs.length === 0) {
                    throw new CommandMatchError(`Missing argument: ${param.name}`, command);
                }

                args[param.name] = {
                    parameter: param,
                    value: restArgs.map(a => a.value)
                };

                break;
            } else if (parsedArg == null || parsedArg.value === "") {
                if (param.required) {
                    throw new CommandMatchError(`Missing argument: ${param.name}`, command);
                } else {
                    value = param.def;
                }
            } else {
                value = parsedArg.value;
            }

            if (param.catchAll && parsedArg) {
                value = [...argStr].slice(parsedArg.index).join("");
            }

            args[param.name] = {
                parameter: param,
                value
            };
        }

        // Convert argument types
        for (const [key, arg] of Object.entries(args)) {
            try {
                arg.value = this.convertToArgumentType(arg.value, arg.parameter.type);
            } catch (e) {
                if (e instanceof TypeConversionError) {
                    throw new CommandMatchError(`Could not convert argument ${arg.parameter.name} to ${arg.parameter.type}`, command);
                }

                throw e;
            }
        }

        // Convert option types
        for (const [key, opt] of Object.entries(opts)) {
            if ((opt.option as FlagOption)) continue;
            try {
                opt.value = this.convertToArgumentType(opt.value, (opt.option as OptionWithValue).type);
            } catch (e) {
                if (e instanceof TypeConversionError) {
                    throw new CommandMatchError(`Could not convert option ${opt.option.name} to ${(opt.option as OptionWithValue).type}`, command);
                }

                throw e;
            }
        }

        return {
            ...command,
            args,
            opts,
        };
    }

    protected convertToArgumentType(value, type): any {
        return this.types[type](value);
    }
}
