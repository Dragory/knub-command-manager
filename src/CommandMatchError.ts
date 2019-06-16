import { CommandConfig, CommandDefinition } from "./types";

export class CommandMatchError<T extends CommandConfig = CommandConfig> extends Error {
  protected command: CommandDefinition<T>;

  constructor(message, command: CommandDefinition<T>) {
    super(message);
    this.command = command;
  }
}
