import escapeStringRegex from "escape-string-regexp";
import {
  IArgument,
  IArgumentMap,
  ICommandConfig,
  ICommandDefinition,
  ICommandManagerOptions,
  IFindMatchingCommandError,
  ITryMatchingCommandResult,
  TFlagOption,
  IMatchedCommand,
  IMatchedOptionMap,
  TOptionWithValue,
  IParameter,
  TTypeConverterFn,
  ITryMatchingArgumentsToSignatureResult,
  isError,
  TOrError,
  TFindMatchingCommandResult,
  findMatchingCommandResultHasError,
  TParseableSignature,
  TSignature
} from "./types";
import { defaultParameterTypes } from "./defaultParameterTypes";
import { parseArguments, TParsedArguments } from "./parseArguments";
import { TypeConversionError } from "./TypeConversionError";
import { parseParameters } from "./parseParameters";

const optMatchRegex = /^--([^\s-]\S*?)(?:=(.+))?$/;
const optShortcutMatchRegex = /^-([^\s-]+?)(?:=(.+))?$/;

const defaultParameter: Partial<IParameter> = {
  required: true,
  def: null,
  rest: false,
  catchAll: false
};

export class CommandManager<
  TContext = null,
  TConfigExtra = null,
  TConfig extends ICommandConfig<TContext, TConfigExtra> = ICommandConfig<TContext, TConfigExtra>
> {
  protected commands: ICommandDefinition<TContext, TConfigExtra>[] = [];

  protected defaultPrefix: RegExp | null = null;
  protected types: { [key: string]: TTypeConverterFn<TContext> };
  protected defaultType: string;

  protected commandId = 0;

  constructor(opts: ICommandManagerOptions<TContext>) {
    if (opts.prefix != null) {
      const prefix = typeof opts.prefix === "string" ? new RegExp(escapeStringRegex(opts.prefix), "i") : opts.prefix;
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
    parameters: TParseableSignature = [],
    config?: TConfig
  ): ICommandDefinition<TContext, TConfigExtra> {
    // If we're overriding the default prefix, convert the new prefix to a regex (or keep it as null for no prefix)
    let prefix = this.defaultPrefix;
    if (config && config.prefix !== undefined) {
      if (config.prefix === null) {
        prefix = null;
      } else if (typeof config.prefix === "string") {
        prefix = new RegExp(`^${escapeStringRegex(config.prefix)}`, "i");
      } else {
        prefix = new RegExp(`^${config.prefix.source}`, config.prefix.flags);
      }
    }

    // Combine all triggers (main trigger + aliases) to a regex
    const triggers = [trigger];
    if (config && config.aliases) triggers.push(...config.aliases);

    const regexTriggers = triggers.map(trigger => {
      if (typeof trigger === "string") {
        return new RegExp(`^${escapeStringRegex(trigger)}(?=\\s|$)`, "i");
      }

      return new RegExp(`^${trigger.source}(?=\\s|$)`, trigger.flags);
    });

    // Like triggers and their aliases, signatures (parameter lists) are provided through both the "parameters" argument
    // and the "overloads" config value
    const inputSignatures = [parameters];
    if (config && config.overloads) inputSignatures.push(...config.overloads);

    const signatures = inputSignatures.map(signature => {
      // If parameters are provided in string format, parse them
      if (typeof signature === "string") {
        signature = parseParameters(signature);
      } else if (signature == null) {
        signature = [];
      }

      signature = signature.map(obj => Object.assign({ type: this.defaultType }, defaultParameter, obj));

      return signature;
    });

    // Validate signatures to prevent unsupported behaviour
    for (const signature of signatures) {
      let hadOptional = false;
      let hadRest = false;
      let hadCatchAll = false;

      signature.forEach(param => {
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
    }

    // Actually add the command to the manager
    const id = ++this.commandId;
    const definition: ICommandDefinition<TContext, TConfigExtra> = {
      id,
      prefix,
      triggers: regexTriggers,
      originalTriggers: triggers,
      signatures,
      options: (config && config.options) || [],
      preFilters: (config && config.preFilters) || [],
      postFilters: (config && config.postFilters) || [],
      config: config || null
    };

    this.commands.push(definition);

    // Return a function to remove the command
    return definition;
  }

  public remove(defOrId: ICommandDefinition<TContext, TConfigExtra> | number) {
    const indexToRemove =
      typeof defOrId === "number" ? this.commands.findIndex(cmd => cmd.id === defOrId) : this.commands.indexOf(defOrId);

    if (indexToRemove !== -1) this.commands.splice(indexToRemove, 1);
  }

  /**
   * Get a command's definition by its id
   */
  public get(id: number): ICommandDefinition<TContext, TConfigExtra> | undefined {
    return this.commands.find(cmd => cmd.id === id);
  }

  /**
   * Get an array of all registered command definitions in the command manager
   */
  public getAll(): Array<ICommandDefinition<TContext, TConfigExtra>> {
    return [...this.commands];
  }

  /**
   * Find the first matching command in the given string, if any.
   * This function returns a promise to support async types and filter functions.
   */
  public async findMatchingCommand(
    str: string,
    ...context: TContext extends null ? [null?] : [TContext]
  ): Promise<TFindMatchingCommandResult<TContext, TConfigExtra> | null> {
    let onlyErrors = true;
    let lastError: string | null = null;
    let lastErrorCmd: ICommandDefinition<TContext, TConfigExtra> | null = null;

    const filterContext = context[0];

    for (const command of this.commands) {
      if (command.preFilters.length) {
        let passed = false;
        for (const filter of command.preFilters) {
          passed = await filter(command, filterContext as TContext);
          if (!passed) break;
        }
        if (!passed) continue;
      }

      const matchResult = await this.tryMatchingCommand(command, str, filterContext as TContext);
      if (matchResult === null) continue;

      if (isError(matchResult)) {
        lastError = matchResult.error;
        lastErrorCmd = command;
        continue;
      }

      onlyErrors = false;

      if (command.postFilters.length) {
        let passed = false;
        for (const filter of command.postFilters) {
          passed = await filter(matchResult.command, filterContext as TContext);
          if (!passed) break;
        }
        if (!passed) continue;
      }

      return matchResult.command;
    }

    if (onlyErrors && lastError !== null) {
      return {
        error: lastError,
        command: lastErrorCmd as ICommandDefinition<TContext, TConfigExtra>
      };
    }

    return null;
  }

  /**
   * Type guard to check if the findMatchingCommand result had an error in a way that TypeScript understands it and
   * narrows types properly afterwards.
   *
   * This is part of the manager class as otherwise the TContext and TExtra types would have to be specified any time
   * this function is used. Having it here in the manager lets us set those automatically.
   */
  public findMatchingCommandResultHasError(
    result: TFindMatchingCommandResult<TContext, TConfigExtra>
  ): result is IFindMatchingCommandError<TContext, TConfigExtra> {
    return findMatchingCommandResultHasError<TContext, TConfigExtra>(result);
  }

  /**
   * Attempts to match the given command to a string.
   */
  protected async tryMatchingCommand(
    command: ICommandDefinition<TContext, TConfigExtra>,
    str: string,
    context: TContext
  ): Promise<TOrError<ITryMatchingCommandResult<TContext, TConfigExtra>> | null> {
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

    let signatureMatchResult: TOrError<ITryMatchingArgumentsToSignatureResult> | null = null;
    for (const signature of command.signatures) {
      signatureMatchResult = this.tryMatchingArgumentsToSignature(command, parsedArguments, signature, str, context);
      if (!isError(signatureMatchResult)) break;
    }

    if (signatureMatchResult == null) {
      return { error: "Command has no signatures" };
    }

    if (isError(signatureMatchResult)) {
      return { error: signatureMatchResult.error };
    }

    return {
      command: {
        ...command,
        args: signatureMatchResult.args,
        opts: signatureMatchResult.opts
      }
    };
  }

  protected tryMatchingArgumentsToSignature(
    command: ICommandDefinition<TContext, TConfigExtra>,
    parsedArguments: TParsedArguments,
    signature: TSignature,
    str: string,
    context: TContext
  ): TOrError<ITryMatchingArgumentsToSignatureResult> {
    const args: IArgumentMap = {};
    const opts: IMatchedOptionMap = {};

    let paramIndex = 0;
    for (let i = 0; i < parsedArguments.length; i++) {
      const arg = parsedArguments[i];

      if (!arg.quoted) {
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

          let optValue: string | boolean = fullOptMatch[2];

          if ((opt as TFlagOption).flag) {
            if (optValue) {
              return { error: `Flags can't have values: --${optName}` };
            }
            optValue = true;
          } else if (optValue == null) {
            // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
            const nextArg = parsedArguments[i + 1];
            if (!nextArg) {
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
            const isLast = j === matchingOpts.length - 1;
            if (isLast) {
              if ((opt as TFlagOption).flag) {
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
                if (!nextArg) {
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
              if (!(opt as TFlagOption).flag) {
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
      }

      // Argument wasn't an option, so match it to a parameter instead
      const param = signature[paramIndex];
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
          usesDefaultValue: true
        };
      }
    }

    for (const param of signature) {
      if (args[param.name] != null) continue;
      if (param.required) {
        return { error: `Missing required argument: ${param.name}` };
      }
      if (param.def) {
        args[param.name] = {
          parameter: param,
          value: param.def,
          usesDefaultValue: true
        };
      }
    }

    // Convert types
    for (const arg of Object.values(args)) {
      if (arg.usesDefaultValue) continue;
      try {
        if (arg.parameter.rest) {
          arg.value = arg.value.map(v =>
            this.convertToArgumentType(v, arg.parameter.type || this.defaultType, context)
          );
        } else {
          arg.value = this.convertToArgumentType(arg.value, arg.parameter.type || this.defaultType, context);
        }
      } catch (e) {
        if (e instanceof TypeConversionError) {
          return { error: `Could not convert argument ${arg.parameter.name} to type ${arg.parameter.type}` };
        }

        throw e;
      }
    }

    for (const opt of Object.values(opts)) {
      if (opt.option.flag) continue;
      if (opt.usesDefaultValue) continue;
      try {
        opt.value = this.convertToArgumentType(opt.value, opt.option.type || this.defaultType, context);
      } catch (e) {
        if (e instanceof TypeConversionError) {
          return { error: `Could not convert option ${opt.option.name} to type ${opt.option.type}` };
        }

        throw e;
      }
    }

    return {
      args,
      opts
    };
  }

  protected convertToArgumentType(value: any, type: string, context: TContext): any {
    return this.types[type](value, context);
  }
}
