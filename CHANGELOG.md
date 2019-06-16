# Changelog

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
