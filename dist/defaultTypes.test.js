"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defaultTypes_1 = require("./defaultTypes");
// Type testing, will fail on compilation if there are errors
const str = defaultTypes_1.string();
const isString = true;
const num = defaultTypes_1.number();
const isNumber = true;
const _bool = defaultTypes_1.bool();
const isBool = true;
const switchOpt = defaultTypes_1.switchOption();
const isOption = true;
const isSwitch = true;
const switchIsBool = true;
