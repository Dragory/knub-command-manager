import escapeStringRegex from "escape-string-regexp";
import {
  IArgument,
  IArgumentMap,
  ICommandConfig,
  ICommandDefinition,
  ICommandManagerOptions,
  IFindMatchingCommandError,
  ITryMatchingCommandResult,
  TSwitchOption,
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
  TSignature,
  IMatchedOption
} from "./types";
import { defaultParameterTypes } from "./defaultParameterTypes";
import { parseArguments, TParsedArguments } from "./parseArguments";
import { TypeConversionError } from "./TypeConversionError";
import { parseParameters } from "./parseParameters";

const optMatchRegex = /^(\S*?)(?:=(.+))?$/;
const defaultOptionPrefixes = ["-", "--"];

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
  protected originalDefaultPrefix: string | RegExp | null = null;
  protected types: { [key: string]: TTypeConverterFn<TContext> };
  protected defaultType: string;
  protected optionPrefixes: string[];

  protected commandId = 0;

  constructor(opts: ICommandManagerOptions<TContext>) {
    if (opts.prefix != null) {
      const prefix = typeof opts.prefix === "string" ? new RegExp(escapeStringRegex(opts.prefix), "i") : opts.prefix;
      this.originalDefaultPrefix = opts.prefix;
      this.defaultPrefix = new RegExp(`^${prefix.source}`, prefix.flags);
    }

    this.types = opts.types || defaultParameterTypes;
    this.defaultType = opts.defaultType || "string";
    this.optionPrefixes = Array.from(opts.optionPrefixes || defaultOptionPrefixes);

    // Sort the prefixes descending by length so that if a longer prefix includes a shorter one at the start,
    // the shorter one isn't matched first
    this.optionPrefixes.sort((a, b) => {
      if (a.length > b.length) return -1;
      if (a.length < b.length) return 1;
      return 0;
    });

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
    let originalPrefix = this.originalDefaultPrefix;

    if (config && config.prefix !== undefined) {
      if (config.prefix === null) {
        prefix = null;
        originalPrefix = null;
      } else if (typeof config.prefix === "string") {
        prefix = new RegExp(`^${escapeStringRegex(config.prefix)}`, "i");
        originalPrefix = config.prefix;
      } else {
        prefix = new RegExp(`^${config.prefix.source}`, config.prefix.flags);
        originalPrefix = config.prefix;
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
      originalPrefix,
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
   * Returns the prefix that is currently being used as the default prefix for added commands.
   * This is the internal RegExp representation of the passed "prefix" option.
   */
  public getDefaultPrefix(): RegExp | null {
    return this.defaultPrefix;
  }

  /**
   * Returns the original prefix passed in CommandManager options, if any
   */
  public getOriginalDefaultPrefix(): string | RegExp | null {
    return this.originalDefaultPrefix;
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
      signatureMatchResult = await this.tryMatchingArgumentsToSignature(
        command,
        parsedArguments,
        signature,
        str,
        context
      );
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

  protected async tryMatchingArgumentsToSignature(
    command: ICommandDefinition<TContext, TConfigExtra>,
    parsedArguments: TParsedArguments,
    signature: TSignature,
    str: string,
    context: TContext
  ): Promise<TOrError<ITryMatchingArgumentsToSignatureResult>> {
    const args: IArgumentMap = {};
    const opts: IMatchedOptionMap = {};

    let paramIndex = 0;
    for (let i = 0; i < parsedArguments.length; i++) {
      const arg = parsedArguments[i];

      // Check if the argument is an -option or its shortcut -o
      // Supports multiple prefixes from the optionPrefixes config option
      const matchingOptionPrefix = this.optionPrefixes.find(pr => arg.value.startsWith(pr));
      if (matchingOptionPrefix) {
        let optMatch = arg.value.slice(matchingOptionPrefix.length).match(optMatchRegex);

        if (optMatch) {
          const optName = optMatch[1];

          const opt = command.options.find(o => o.name === optName || o.shortcut === optName);
          if (!opt) {
            return { error: `Unknown option: ${matchingOptionPrefix}${optName}` };
          }

          let optValue: string | boolean = optMatch[2];

          if ((opt as TSwitchOption).isSwitch) {
            if (optValue) {
              return { error: `Switch options can't have values: ${matchingOptionPrefix}${optName}` };
            }
            optValue = true;
          } else if (optValue == null) {
            // If we're not a flag, and we don't have a =value, consume the next argument as the value instead
            const nextArg = parsedArguments[i + 1];
            if (!nextArg) {
              return { error: `No value for option: ${matchingOptionPrefix}${optName}` };
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
      if (opt.isSwitch) continue;
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
          const values: any[] = [];
          for (const value of arg.value) {
            values.push(await this.convertToArgumentType(value, arg.parameter.type || this.defaultType, context));
          }
          arg.value = values;
        } else {
          arg.value = await this.convertToArgumentType(arg.value, arg.parameter.type || this.defaultType, context);
        }
      } catch (e) {
        if (e instanceof TypeConversionError) {
          return { error: `Could not convert argument ${arg.parameter.name} to type ${arg.parameter.type}` };
        }

        throw e;
      }
    }

    for (const opt of Object.values(opts)) {
      if (opt.option.isSwitch) continue;
      if (opt.usesDefaultValue) continue;
      try {
        opt.value = await this.convertToArgumentType(opt.value, opt.option.type || this.defaultType, context);
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
