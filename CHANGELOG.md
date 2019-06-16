# Changelog

## 3.1.3
* Fix incorrect parsing of catch-all arguments as first arguments
  * The catch-all argument also included the preceding space

## 3.1.2
* Triggers now only match if they're followed by whitespace or the end of the string.
This fixes short triggers, e.g. `s`, matching the beginning of longer triggers, e.g. `suspend`.

## 3.1.1
* Fix prefixes and triggers matching anywhere in the string

## 3.1.0
* Export `TypeConversionError`

## 3.0.0
* Deprecate `TCustomProps` generic type that was used to store data with commands
* Add `TFilterContext` generic type to CommandManager. Setting this allows you to pass additional context data when
calling `findMatchingCommand(str, context)` which can be accessed in filter functions as the second argument.
Useful for e.g. passing the message object where the command was called from in Discord bots.

## 2.0.0
* Split filters into pre-filters and post-filters. The old filters were equivalent to post filters.
* Options within "quoted" arguments are now ignored.
* As before, anything after ` -- ` is counted as the last argument,
but now it's also considered to be "quoted" for the purposes of matching options.

## 1.0.0
* Initial release
