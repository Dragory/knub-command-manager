import {
  ICommandConfig,
  ICommandDefinition,
  ICommandManagerOptions,
  IFindMatchingCommandError,
  IMatchedCommand,
  IMatchedSignature,
  TOrError,
  TSignature,
} from "./types";
import { TParsedArguments } from "./parseArguments";
export declare class CommandManager<
  TContext = null,
  TConfigExtra = null,
  TConfig extends ICommandConfig<TContext, TConfigExtra> = ICommandConfig<TContext, TConfigExtra>
> {
  protected commands: ICommandDefinition<TContext, TConfigExtra>[];
  protected defaultPrefix: RegExp | null;
  protected originalDefaultPrefix: string | RegExp | null;
  protected optionPrefixes: string[];
  protected commandId: number;
  constructor(opts: ICommandManagerOptions<TContext>);
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
  add(
    trigger: string | RegExp | string[] | RegExp[],
    signature?: TSignature<TContext> | TSignature<TContext>[],
    config?: TConfig,
  ): ICommandDefinition<TContext, TConfigExtra>;
  remove(defOrId: ICommandDefinition<TContext, TConfigExtra> | number): void;
  /**
   * Get a command's definition by its id
   */
  get(id: number): ICommandDefinition<TContext, TConfigExtra> | undefined;
  /**
   * Get an array of all registered command definitions in the command manager
   */
  getAll(): Array<ICommandDefinition<TContext, TConfigExtra>>;
  /**
   * Returns the prefix that is currently being used as the default prefix for added commands.
   * This is the internal RegExp representation of the passed "prefix" option.
   */
  getDefaultPrefix(): RegExp | null;
  /**
   * Returns the original prefix passed in CommandManager options, if any
   */
  getOriginalDefaultPrefix(): string | RegExp | null;
  /**
   * Find the first matching command in the given string, if any.
   * This function returns a promise to support async types and filter functions.
   */
  findMatchingCommand(
    str: string,
    ...context: TContext extends null ? [null?] : [TContext]
  ): Promise<TOrError<
    IMatchedCommand<TContext, TConfigExtra>,
    IFindMatchingCommandError<TContext, TConfigExtra>
  > | null>;
  /**
   * Attempts to match the given command to a string.
   */
  tryMatchingCommand(
    command: ICommandDefinition<TContext, TConfigExtra>,
    str: string,
    context: TContext,
  ): Promise<TOrError<IMatchedCommand<TContext, TConfigExtra>> | null>;
  protected tryMatchingArgumentsToSignature(
    command: ICommandDefinition<TContext, TConfigExtra>,
    parsedArguments: TParsedArguments,
    signature: TSignature<TContext>,
    str: string,
    context: TContext,
  ): Promise<TOrError<IMatchedSignature<TContext>>>;
}
