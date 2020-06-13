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
  IMatchedSignature,
  isError,
  TOrError,
  TFindMatchingCommandResult,
  findMatchingCommandResultHasError,
  TSignature,
  IMatchedOption,
  isSwitchOption
} from "./types";
import { defaultTypeConverters } from "./defaultTypes";
import { parseArguments, TParsedArguments } from "./parseArguments";
import { TypeConversionError } from "./TypeConversionError";
import { parseParameters } from "./parseParameters";

const optMatchRegex = /^(\S*?)(?:=(.+))?$/;
const defaultOptionPrefixes = ["-", "--"];

const defaultParameter: Partial<IParameter<any>> = {
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
  protected optionPrefixes: string[];

  protected commandId = 0;

  constructor(opts: ICommandManagerOptions<TContext>) {
    if (opts.prefix != null) {
      const prefix = typeof opts.prefix === "string" ? new RegExp(escapeStringRegex(opts.prefix), "i") : opts.prefix;
      this.originalDefaultPrefix = opts.prefix;
      this.defaultPrefix = new RegExp(`^${prefix.source}`, prefix.flags);
    }

    this.optionPrefixes = Array.from(opts.optionPrefixes || defaultOptionPrefixes);

    // Sort the prefixes descending by length so that if a longer prefix includes a shorter one at the start,
    // the shorter one isn't matched first
    this.optionPrefixes.sort((a, b) => {
      if (a.length > b.length) return -1;
      if (a.length < b.length) return 1;
      return 0;
    });
  }

  /**
   * Adds a command to the manager.
   *
   * Examples:
   *
   * `add("add", parseParameters("<first:string> <second:number>"))`
   *   Adds a command called "add" with two required parameters.
   *   This example uses an easy-to-read string format for specifying parameters, parsed by parseParameters().
   *
   * `add("add", { first: string(), second: number() })`
   *   Adds a command called "add" with two required parameters. This is equivalent to the first example.
   *   The string() and number() helpers are provided by the package.
   *
   * `add("echo", { text: { type: v => String(v), catchAll: true } })`
   *   Adds a command with a required argument "text" that captures the entire rest of the arguments.
   *   The parameter object here is defined explicitly rather than using one of the helpers above.
   *
   * `add("mul", parseParameters("<name:string> [numbers:number...]"))`
   *   Adds a command with two arguments: a required string called 'name' and an optional repeatable argument "numbers".
   */
  public add(
    trigger: string | RegExp | string[] | RegExp[],
    parameters: TSignature<TContext> | TSignature<TContext>[] = [],
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
    const triggers = Array.isArray(trigger) ? trigger : [trigger];
    const regexTriggers = triggers.map(trigger => {
      if (typeof trigger === "string") {
        return new RegExp(`^${escapeStringRegex(trigger)}(?=\\s|$)`, "i");
      }

      return new RegExp(`^${trigger.source}(?=\\s|$)`, trigger.flags);
    });

    // Like triggers and their aliases, signatures (parameter lists) are provided through both the "parameters" argument
    // and the "overloads" config value
    const inputSignatures = Array.isArray(parameters) ? parameters : [parameters];
    const signatures: TSignature<TContext>[] = inputSignatures.map(inputSignature => {
      return Object.entries(inputSignature).reduce((obj, [name, param]) => {
        obj[name] = {
          ...defaultParameter,
          ...param
        };
        return obj;
      }, {});
    });

    // Validate signatures to prevent unsupported behaviour
    for (const signature of signatures) {
      let hadOptional = false;
      let hadRest = false;
      let hadCatchAll = false;

      for (const param of Object.values(signature)) {
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
      }
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

      const matchedCommand = await this.tryMatchingCommand(command, str, filterContext as TContext);
      if (matchedCommand === null) continue;

      if (isError(matchedCommand)) {
        lastError = matchedCommand.error;
        lastErrorCmd = command;
        continue;
      }

      onlyErrors = false;

      if (command.postFilters.length) {
        let passed = false;
        for (const filter of command.postFilters) {
          passed = await filter(matchedCommand, filterContext as TContext);
          if (!passed) break;
        }
        if (!passed) continue;
      }

      return matchedCommand;
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
  public async tryMatchingCommand(
    command: ICommandDefinition<TContext, TConfigExtra>,
    str: string,
    context: TContext
  ): Promise<TOrError<IMatchedCommand<TContext, TConfigExtra>> | null> {
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
    const signatures = command.signatures.length > 0 ? command.signatures : [{}];

    let signatureMatchResult: TOrError<IMatchedSignature<TContext>> = { error: "?" };
    for (const signature of signatures) {
      signatureMatchResult = await this.tryMatchingArgumentsToSignature(
        command,
        parsedArguments,
        signature,
        str,
        context
      );
      if (!isError(signatureMatchResult)) break;
    }

    if (isError(signatureMatchResult)) {
      return { error: signatureMatchResult.error };
    }

    return {
      ...command,
      args: signatureMatchResult.args,
      opts: signatureMatchResult.opts
    };
  }

  protected async tryMatchingArgumentsToSignature(
    command: ICommandDefinition<TContext, TConfigExtra>,
    parsedArguments: TParsedArguments,
    signature: TSignature<TContext>,
    str: string,
    context: TContext
  ): Promise<TOrError<IMatchedSignature<TContext>>> {
    const args: IArgumentMap<TContext> = {};
    const opts: IMatchedOptionMap<TContext> = {};

    const parameters = Object.entries(signature);

    let paramIndex = 0;
    for (let i = 0; i < parsedArguments.length; i++) {
      const arg = parsedArguments[i];

      if (!arg.quoted) {
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
      }

      // Argument wasn't an option, so match it to a parameter instead
      const [paramName, param] = parameters[paramIndex] || [];
      if (!param) {
        return { error: `Too many arguments` };
      }

      if (param.rest) {
        const restArgs = parsedArguments.slice(i);
        if (param.required && restArgs.length === 0) {
          return { error: `Missing required argument: ${paramName}` };
        }

        args[paramName] = {
          parameter: param,
          value: restArgs.map(a => a.value)
        };

        break;
      }

      if (param.catchAll) {
        args[paramName] = {
          parameter: param,
          value: str.slice(arg.index)
        };

        break;
      }

      args[paramName] = {
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

    for (const [paramName, param] of parameters) {
      if (args[paramName] != null) continue;
      if (param.required) {
        return { error: `Missing required argument: ${paramName}` };
      }
      if (param.def) {
        args[paramName] = {
          parameter: param,
          value: param.def,
          usesDefaultValue: true
        };
      }
    }

    // Convert types
    for (const [argName, arg] of Object.entries(args)) {
      if (arg.usesDefaultValue) continue;
      try {
        if (arg.parameter.rest) {
          const values: any[] = [];
          for (const value of arg.value) {
            values.push(await arg.parameter.type(value, context));
          }
          arg.value = values;
        } else {
          arg.value = await arg.parameter.type(arg.value, context);
        }
      } catch (e) {
        if (e instanceof TypeConversionError) {
          return { error: `Could not convert argument ${argName}'s type: ${e.message}` };
        }

        throw e;
      }
    }

    for (const opt of Object.values(opts)) {
      if (isSwitchOption(opt.option)) {
        continue;
      } else {
        if (opt.usesDefaultValue) continue;
        try {
          opt.value = await opt.option.type(opt.value, context);
        } catch (e) {
          if (e instanceof TypeConversionError) {
            return { error: `Could not convert option ${opt.option.name} to type ${opt.option.type}` };
          }

          throw e;
        }
      }
    }

    return {
      args,
      opts
    };
  }
}
