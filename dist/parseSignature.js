"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSignature = void 0;
const defaultTypes_1 = require("./defaultTypes");
function parseSignature(str, types = defaultTypes_1.defaultTypeConverters, defaultType = "string") {
    if (!types[defaultType]) {
        throw new Error(`Default type does not exist: ${defaultType}`);
    }
    const chars = [...str];
    const result = {};
    let currentItem = null;
    let currentOption = {};
    let currentParameter = {};
    let currentName = "";
    let state = null;
    let currentLiteral = "";
    let quoted = false;
    const flush = () => {
        if (currentLiteral === "") {
            return;
        }
        if (state === "name") {
            currentName = currentLiteral;
        }
        else if (state === "type") {
            if (!types[currentLiteral]) {
                throw new Error(`Unknown type: ${currentLiteral}`);
            }
            if (currentItem === "parameter")
                currentParameter.type = types[currentLiteral];
            else if (currentItem === "option")
                currentOption.type = types[currentLiteral];
        }
        else if (state === "value") {
            if (currentItem === "parameter")
                currentParameter.def = currentLiteral;
            else if (currentItem === "option")
                currentOption.def = currentLiteral;
        }
        else if (state === "shortcut") {
            if (currentItem !== "option") {
                throw new Error("Shortcuts can only be specified for options");
            }
            currentOption.shortcut = currentLiteral;
        }
        else {
            throw new Error("Can't flush from empty state");
        }
        currentLiteral = "";
    };
    const saveCurrentParameter = () => {
        result[currentName] = {
            option: false,
            type: types[defaultType],
            ...currentParameter,
        };
        currentParameter = {};
        currentName = "";
        currentItem = null;
        state = null;
    };
    const saveCurrentOption = () => {
        result[currentName] = {
            option: true,
            type: defaultTypes_1.defaultTypeConverters.bool,
            isSwitch: true,
            ...currentOption,
        };
        currentOption = {};
        currentName = "";
        currentItem = null;
        state = null;
    };
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (char === '"' || char === "'") {
            quoted = !quoted;
        }
        else if (quoted) {
            currentLiteral += char;
        }
        else if (char === "<") {
            state = "name";
            currentItem = "parameter";
            currentParameter.required = true;
        }
        else if (char === "[") {
            state = "name";
            currentItem = "parameter";
            currentParameter.required = false;
        }
        else if (char === "-") {
            state = "name";
            currentItem = "option";
        }
        else if (char === "|" && currentItem === "option" && state === "name") {
            flush();
            state = "shortcut";
        }
        else if (char === ":") {
            flush();
            state = "type";
            // If an option has a type, it's not a switch
            if (currentItem === "option") {
                currentOption.isSwitch = false;
            }
        }
        else if (char === "=") {
            flush();
            state = "value";
        }
        else if (char === "$") {
            flush();
            currentParameter.catchAll = true;
        }
        else if (char === "." && chars.slice(i, i + 3).join("") === "...") {
            flush();
            currentParameter.rest = true;
            i += 2; // +1 from loop
        }
        else if (char.match(/\s/)) {
            if (currentItem === "option") {
                flush();
                saveCurrentOption();
            }
            else if (currentItem === "parameter") {
                currentLiteral += char;
            }
        }
        else if (char === ">" || char === "]") {
            flush();
            saveCurrentParameter();
        }
        else {
            currentLiteral += char;
        }
    }
    if (currentItem === "option") {
        flush();
        saveCurrentOption();
    }
    else if (currentItem === "parameter") {
        throw new Error(`Unterminated parameter at the end of '${str}'`);
    }
    return result;
}
exports.parseSignature = parseSignature;
