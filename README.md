# Knub Command Manager
[![npm version](https://img.shields.io/npm/v/knub-command-manager)][npm]

[npm]: https://www.npmjs.com/package/knub-command-manager

Knub Command Manager is a library for managing and matching text-based commands.
It was created for use in [Knub](https://github.com/dragory/Knub), a Discord bot
framework, but can also be used as standalone.

## Features
* Command prefixes (e.g. `!command` where `!` is the prefix)
* Regex support for prefixes and command names
* Required and optional arguments
* `-options` and `-switches` with shortcuts (e.g. `-f`)
  * Customizable option prefixes (defaults to `--` and `-`)
* Parameter/option types with runtime validation and type conversion
  * Including custom types
* Default values for arguments/options
* "Rest arguments" (multiple arguments returned in an array) and "catch-all"
  arguments (treats the rest of the string as the value for that argument)
* Filters that are run before and after commands signature validation
  * "Pre-filters" (run before) are useful for e.g. checking if the command is
    valid to use in the current context. If a pre-filter fails, command matching
    is resumed to other potentially matching commands.
  * "Post-filters" (run after) are useful for e.g. command cooldowns. If a
    post-filter fails, command matching is not resumed and no error is returned,
    making the result equivalent to no command matching at all.
* Full TypeScript typings with generics for custom data passed to filters and
  argument/option type conversion functions and for extra data passed in command
  configuration

## Installation
`npm install knub-command-manager`

## Basic usage

```js
import { CommandManager } from 'knub-command-manager';

const manager = new CommandManager({
  prefix: '!'
});

const registeredCommand = manager.add('echo', '<text:string>');

const matchedCommand = manager.findMatchingCommand('!echo hello');
```
