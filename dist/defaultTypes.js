"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchOption = exports.bool = exports.number = exports.string = exports.defaultTypeConverters = void 0;
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
exports.string = (opts) => {
    return {
        ...(opts || {}),
        type: exports.defaultTypeConverters.string,
    };
};
exports.number = (opts) => {
    return {
        ...opts,
        type: exports.defaultTypeConverters.number,
    };
};
exports.bool = (opts) => {
    return {
        ...opts,
        type: exports.defaultTypeConverters.bool,
    };
};
exports.switchOption = (opts) => {
    return {
        ...opts,
        option: true,
        isSwitch: true,
        type: exports.defaultTypeConverters.bool,
    };
};
