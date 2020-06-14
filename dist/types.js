"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isError = exports.isMatchedArgument = void 0;
function isMatchedArgument(value) {
    return value.parameter != null;
}
exports.isMatchedArgument = isMatchedArgument;
function isError(value) {
    return value.error != null;
}
exports.isError = isError;
