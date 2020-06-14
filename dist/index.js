"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./types"), exports);
var CommandManager_1 = require("./CommandManager");
Object.defineProperty(exports, "CommandManager", { enumerable: true, get: function () { return CommandManager_1.CommandManager; } });
var parseArguments_1 = require("./parseArguments");
Object.defineProperty(exports, "parseArguments", { enumerable: true, get: function () { return parseArguments_1.parseArguments; } });
var parseSignature_1 = require("./parseSignature");
Object.defineProperty(exports, "parseSignature", { enumerable: true, get: function () { return parseSignature_1.parseSignature; } });
__exportStar(require("./defaultTypes"), exports);
var TypeConversionError_1 = require("./TypeConversionError");
Object.defineProperty(exports, "TypeConversionError", { enumerable: true, get: function () { return TypeConversionError_1.TypeConversionError; } });
