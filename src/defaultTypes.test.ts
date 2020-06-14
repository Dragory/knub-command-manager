import { string, number, bool, switchOption } from "./defaultTypes";

type AssertEquals<TActual, TExpected> = TActual extends TExpected ? true : false;

// Type testing, will fail on compilation if there are errors

const str = string();
const isString: AssertEquals<ReturnType<typeof str.type>, string> = true;

const num = number();
const isNumber: AssertEquals<ReturnType<typeof num.type>, number> = true;

const _bool = bool();
const isBool: AssertEquals<ReturnType<typeof _bool.type>, boolean> = true;

const switchOpt = switchOption();
const isOption: AssertEquals<typeof switchOpt.option, true> = true;
const isSwitch: AssertEquals<typeof switchOpt.isSwitch, true> = true;
const switchIsBool: AssertEquals<ReturnType<typeof switchOpt.type>, boolean> = true;
