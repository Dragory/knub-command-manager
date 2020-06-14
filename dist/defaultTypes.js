"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchOption = exports.bool = exports.number = exports.string = exports.createTypeHelper = exports.defaultTypeConverters = void 0;
const TypeConversionError_1 = require("./TypeConversionError");
exports.defaultTypeConverters = {
    string(value, context) {
        return String(value);
    },
    number(value, context) {
        if (isNaN(value))
            throw new TypeConversionError_1.TypeConversionError(`Value is not a number`);
        return parseFloat(value);
    },
    bool(value, context) {
        return value === "true" || value === "1";
    },
};
function createTypeHelper(converterFn) {
    return (opts) => {
        return {
            ...(opts || {}),
            type: converterFn,
        };
    };
}
exports.createTypeHelper = createTypeHelper;
exports.string = createTypeHelper(exports.defaultTypeConverters.string);
exports.number = createTypeHelper(exports.defaultTypeConverters.number);
exports.bool = createTypeHelper(exports.defaultTypeConverters.bool);
exports.switchOption = (opts) => {
    return {
        ...opts,
        option: true,
        isSwitch: true,
        type: exports.defaultTypeConverters.bool,
    };
};
