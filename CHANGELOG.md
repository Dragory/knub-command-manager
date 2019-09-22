# Changelog

## 5.0.0
* Add support for command signature overloads via new `overloads` property in
  command config
* Rename all exported types/interfaces to have an I/T prefix (depending on
  whether it's a type or an interface)
  * E.g. `CommandConfig` -> `ICommandConfig`

## 4.4.0
* Include trigger sources (i.e. as they were supplied to `CommandManager.add()`)
  in `CommandDefinition.originalTriggers`
  * This is an array that also includes the sources of any specified aliases

## 4.3.0
* Add `CommandManager.getAll()` to get all registered commands

## 4.2.0
* When `CommandManager.findMatchingCommands()` returns an error (the
  `{ error: string }` return object), the definition of the last command that
  triggered an error will now also be returned (as the `command` property)

## 4.1.0
* All types from `src/types.ts` are now exported from the main script

## 4.0.0
* **BREAKING CHANGE:** Instead of being able to specify the type of command
  config directly (as the second generic type of `CommandManager`), you can now
  specify the type of an `extra` property in the config
* Filter context (`TFilterContext`, now called `TContext`) is now also passed to
  type conversion functions as the second parameter, allowing context-aware
  argument/option types

## 3.3.2
* Dev dependency updates. New release so the `package.json` on npm and GitHub
  are the same.

## 3.3.1
* Include `typings` in package.json

## 3.3.0
* Move `CommandManager.parseParameterString()` to a standalone function called
  `parseParameters` and export it

## 3.2.0
* The original command config object is now accessible through the `config`
  property on the command definition object (returned by `add()`)
* `CommandManager` now has a second type you can specify: the type of the
  command config object. This type must extend the original `CommandConfig` type

## 3.1.3
* Fix incorrect parsing of catch-all arguments as first arguments
  * The catch-all argument also included the preceding space

## 3.1.2
* Triggers now only match if they're followed by whitespace or the end of the
  string. This fixes short triggers, e.g. `s`, matching the beginning of longer
  triggers, e.g. `suspend`.

## 3.1.1
* Fix prefixes and triggers matching anywhere in the string

## 3.1.0
* Export `TypeConversionError`

## 3.0.0
* Deprecate `TCustomProps` generic type that was used to store data with
  commands
* Add `TFilterContext` generic type to CommandManager. Setting this allows you
  to pass additional context data when calling
  `findMatchingCommand(str, context)` which can be accessed in filter functions
  as the second argument. Useful for e.g. passing the message object where the
  command was called from in Discord bots.

## 2.0.0
* Split filters into pre-filters and post-filters. The old filters were
  equivalent to post filters
* Options within "quoted" arguments are now ignored
* As before, anything after ` -- ` is counted as the last argument, but now it's
  also considered to be "quoted" for the purposes of matching options

## 1.0.0
* Initial release
