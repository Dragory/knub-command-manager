import escapeStringRegex from "escape-string-regexp";
import {
    Argument,
    ArgumentMap,
    CommandConfig,
    CommandDefinition,
    CommandManagerOptions, CommandMatchResult, CommandMatchResultError, CommandMatchResultSuccess, FlagOption,
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
const optShortcutMatchRegex = /^-([^\s-]+?)(?:=(.+))?$/;

const defaultParameter: Partial<Parameter> = {
    required: true,
    def: null,
    rest: false,
    catchAll: false
};

export class CommandManager<TCustomProps = {}> {
    protected commands: CommandDefinition<TCustomProps>[] = [];

    protected defaultPrefix: RegExp | null = null;
    protected types: { [key: string]: TypeConverterFn };
    protected defaultType: string;

    constructor(opts: CommandManagerOptions) {
        if (opts.prefix != null) {
            const prefix = typeof opts.prefix === "string"
                ? new RegExp(escapeStringRegex(opts.prefix), 'i')
                : opts.prefix;
            this.defaultPrefix = new RegExp(`^${prefix.source}`, prefix.flags);
        }

        this.types = opts.types || defaultParameterTypes;
        this.defaultType = opts.defaultType || "string";

        if (!this.types[this.defaultType]) {
            throw new Error(`Default type "${this.defaultType}" not found in types!`);
        }
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
        config: CommandConfig<TCustomProps> = {},
        customProps?: TCustomProps
    ): () => void {
        // If we're overriding the default prefix, convert the new prefix to a regex (or keep it as null for no prefix)
        let prefix = this.defaultPrefix;
        if (config.prefix !== undefined) {
            if (config.prefix === null) {
                prefix = null;
            } else if (typeof config.prefix === "string") {
                prefix = new RegExp(escapeStringRegex(config.prefix), 'i');
            } else {
                prefix = config.prefix;
            }
        }

        // Combine all triggers (main trigger + aliases) to a regex
        const triggers = [trigger];
        if (config && config.aliases) triggers.push(...config.aliases);

        const regexTriggers = triggers.map(trigger => {
            if (typeof trigger === "string") {
                return new RegExp(escapeStringRegex(trigger), "i");
            }

            return new RegExp(`^${trigger.source}`, trigger.flags);
        });

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
                if (hadOptional) {
                    throw new Error(`Can only have 1 optional parameter to avoid ambiguity`);
                }

                hadOptional = true;
            } else if (hadOptional) {
                throw new Error(`Optional parameter must come last`);
            }

            if (hadRest) {
                throw new Error(`Rest parameter must come last`);
            }

            if (param.rest) {
                hadRest = true;
            }

            if (hadCatchAll) {
                throw new Error(`Catch-all parameter must come last`);
            }

            if (param.catchAll) {
                hadCatchAll = true;
            }
        });

        // Actually add the command to the manager
        const definition: CommandDefinition<TCustomProps> = {
            prefix,
            triggers: regexTriggers,
            parameters,
            options: config && config.options || [],
            filters: config && config.filters || [],
            customProps,
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
    public async findMatchingCommand(str: string): Promise<MatchedCommand<TCustomProps>|{ error: string }|null> {
        let onlyErrors = true;
        let lastError: string | null = null;

        for (const command of this.commands) {
            const matchResult = await this.tryMatchingCommand(command, str);
            if (matchResult === null) continue;

            if (matchResult.error !== undefined) {
                lastError = matchResult.error;
                continue;
            }

            onlyErrors = false;

            if (matchResult.command.filters.length) {
                let passed = false;
                for (const filter of matchResult.command.filters) {
                    passed = await filter(matchResult.command);
                    if (! passed) break;
                }
                if (! passed) continue;
            }

            return matchResult.command;
        }

        if (onlyErrors && lastError !== null) {
            return { error: lastError };
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

    /**
     * Attempts to match the given command to a string.
     */
    protected async tryMatchingCommand(command: CommandDefinition<TCustomProps>, str: string): Promise<CommandMatchResult<TCustomProps>|null> {
        if (command.prefix) {
            const prefixMatch = str.match(command.prefix);
            if (!prefixMatch) return null;
            str = str.slice(prefixMatch[0].length);
        }

        let matchedTrigger = false;
        for (const trigger of command.triggers) {
            const triggerMatch = str.match(trigger);
            if (triggerMatch) {
                matchedTrigger = true;
                str = str.slice(triggerMatch[0].length);
            }
        }
        if (!matchedTrigger) return null;

        const parsedArguments = parseArguments(str);
        const args: ArgumentMap = {};
        const opts: MatchedOptionMap = {};

        let paramIndex = 0;
        for (let i = 0; i < parsedArguments.length; i++) {
            const arg = parsedArguments[i];

            // Check if the argument is an --option
            // Both --option=value and --option value syntaxes are supported;
            // in the latter case we consume the next argument as the value
            const fullOptMatch = arg.value.match(optMatchRegex);
            if (fullOptMatch) {
                const optName = fullOptMatch[1];

                const opt = command.options.find(o => o.name === optName);
                if (!opt) {
                    return { error: `Unknown option: --${optName}` };
                }

                let optValue: string|boolean = fullOptMatch[2];

                if ((opt as FlagOption).flag) {
                    if (optValue) {
                        return { error: `Flags can't have values: --${optName}` };
                    }
                    optValue = true;
                } else if (optValue == null) {
                    // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
                    const nextArg = parsedArguments[i + 1];
                    if (! nextArg) {
                        return { error: `No value for option: --${optName}` };
                    }

                    optValue = nextArg.value;

                    // Skip the next arg in the loop since we just consumed it
                    i++;
                }

                opts[opt.name] = {
                    option: opt,
                    value: optValue
                };

                continue;
            }

            // Check if the argument is a string of option shortcuts, i.e. -abcd
            // The last option can have a value with either -abcd=value or -abcd value;
            // in the latter case we consume the next argument as the value
            const optShortcutMatch = arg.value.match(optShortcutMatchRegex);
            if (optShortcutMatch) {
                const shortcuts = [...optShortcutMatch[1]];
                const lastValue = optShortcutMatch[2];
                const optShortcuts = command.options.reduce((map, opt) => {
                    if (opt.shortcut) map[opt.shortcut] = opt;
                    return map;
                }, {});
                const matchingOpts = shortcuts.map(s => optShortcuts[s]);

                const unknownOptShortcutIndex = matchingOpts.findIndex(o => o == null);
                if (unknownOptShortcutIndex !== -1) {
                    return { error: `Unknown option shortcut: -${shortcuts[unknownOptShortcutIndex]}` };
                }

                for (let j = 0; j < matchingOpts.length; j++) {
                    const opt = matchingOpts[j];
                    const isLast = (j === matchingOpts.length - 1);
                    if (isLast) {
                        if ((opt as FlagOption).flag) {
                            if (lastValue) {
                                return { error: `Flags can't have values: -${opt.shortcut}` };
                            }

                            opts[opt.name] = {
                                option: opt,
                                value: true
                            };
                        } else {
                            if (lastValue) {
                                opts[opt.name] = {
                                    option: opt,
                                    value: lastValue
                                };

                                continue;
                            }

                            // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
                            const nextArg = parsedArguments[i + 1];
                            if (! nextArg) {
                                return { error: `No value for option: -${opt.shortcut}` };
                            }

                            opts[opt.name] = {
                                option: opt,
                                value: nextArg.value
                            };

                            // Skip the next arg in the loop since we just consumed it
                            i++;
                        }
                    } else {
                        if (! (opt as FlagOption).flag) {
                            return { error: `No value for option: -${opt.shortcut}` };
                        }

                        opts[opt.name] = {
                            option: opt,
                            value: true
                        };
                    }
                }

                continue;
            }

            // Argument wasn't an option, so match it to a parameter instead
            const param = command.parameters[paramIndex];
            if (!param) {
                return { error: `Too many arguments` };
            }

            if (param.rest) {
                const restArgs = parsedArguments.slice(i);
                if (param.required && restArgs.length === 0) {
                    return { error: `Missing required argument: ${param.name}` };
                }

                args[param.name] = {
                    parameter: param,
                    value: restArgs.map(a => a.value)
                };

                break;
            }

            if (param.catchAll) {
                args[param.name] = {
                    parameter: param,
                    value: str.slice(arg.index)
                };

                break;
            }

            args[param.name] = {
                parameter: param,
                value: arg.value
            };

            paramIndex++;
        }

        // Verify we have all required options and arguments and add default values
        for (const opt of command.options) {
            if (args[opt.name] != null) continue;
            if (opt.flag) continue;
            if (opt.required) {
                return { error: `Missing required option: ${opt.name}` };
            }
            if (opt.def) {
                opts[opt.name] = {
                    option: opt,
                    value: opt.def,
                    usesDefaultValue: true,
                };
            }
        }
        for (const param of command.parameters) {
            if (args[param.name] != null) continue;
            if (param.required) {
                return { error: `Missing required argument: ${param.name}` };
            }
            if (param.def) {
                args[param.name] = {
                    parameter: param,
                    value: param.def,
                    usesDefaultValue: true,
                };
            }
        }

        // Convert types
        for (const arg of Object.values(args)) {
            if (arg.usesDefaultValue) continue;
            if (arg.parameter.rest) {
                arg.value = arg.value.map(v => this.convertToArgumentType(v, arg.parameter.type || this.defaultType));
            } else {
                arg.value = this.convertToArgumentType(arg.value, arg.parameter.type || this.defaultType);
            }
        }
        for (const opt of Object.values(opts)) {
            if (opt.option.flag) continue;
            if (opt.usesDefaultValue) continue;
            opt.value = this.convertToArgumentType(opt.value, opt.option.type || this.defaultType);
        }

        return {
            command: {
                ...command,
                args,
                opts,
            }
        };
    }

    protected convertToArgumentType(value, type): any {
        return this.types[type](value);
    }
}
