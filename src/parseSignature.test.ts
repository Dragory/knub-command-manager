import { config, expect, assert } from "chai";
import { parseSignature } from "./parseSignature";
import { defaultTypeConverters } from "./defaultTypes";

config.truncateThreshold = 0;

describe("parseSignature", () => {
  it("Parse single required parameter", () => {
    const result = parseSignature("<str>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.string,
      required: true,
    });
  });

  it("Parse single required typed parameter", () => {
    const result = parseSignature("<str:number>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.number,
      required: true,
    });
  });

  it("Parse single required parameter with default value", () => {
    const result = parseSignature("<str=10>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.string,
      required: true,
      def: "10",
    });
  });

  it("Parse single required typed parameter with default value", () => {
    const result = parseSignature("<str:number=10>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.number,
      required: true,
      def: "10",
    });
  });

  it("Parse single optional parameter", () => {
    const result = parseSignature("[str]");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.string,
      required: false,
    });
  });

  it("Parse single catch-all parameter", () => {
    const result = parseSignature("<str$>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.string,
      required: true,
      catchAll: true,
    });
  });

  it("Parse single rest parameter", () => {
    const result = parseSignature("<str...>");
    expect(result.str).to.eql({
      option: false,
      type: defaultTypeConverters.string,
      required: true,
      rest: true,
    });
  });

  it("Parse single switch option", () => {
    const result = parseSignature("-opt");
    expect(result.opt).to.eql({
      option: true,
      type: defaultTypeConverters.bool,
      isSwitch: true,
    });
  });

  it("Parse single typed option", () => {
    const result = parseSignature("-opt:string");
    expect(result.opt).to.eql({
      option: true,
      type: defaultTypeConverters.string,
      isSwitch: false,
    });
  });

  it("Parse single switch option with default value", () => {
    const result = parseSignature("-opt=1");
    expect(result.opt).to.eql({
      option: true,
      type: defaultTypeConverters.bool,
      isSwitch: true,
      def: "1",
    });
  });

  it("Parse single switch option with default value", () => {
    const result = parseSignature("-opt:string=hello");
    expect(result.opt).to.eql({
      option: true,
      type: defaultTypeConverters.string,
      isSwitch: false,
      def: "hello",
    });
  });

  it("Parse option with shortcut", () => {
    const result = parseSignature("-opt|o:string=hi");
    expect(result.opt).to.eql({
      option: true,
      type: defaultTypeConverters.string,
      isSwitch: false,
      shortcut: "o",
      def: "hi",
    });
  });

  it("Parse multiple parameters", () => {
    const result = parseSignature("<arg1:string> <arg2:number>");
    expect(result).to.eql({
      arg1: {
        option: false,
        type: defaultTypeConverters.string,
        required: true,
      },
      arg2: {
        option: false,
        type: defaultTypeConverters.number,
        required: true,
      },
    });
  });

  it("Parse multiple options", () => {
    const result = parseSignature("-opt1 -opt2:string=foo -opt3:number");
    expect(result).to.eql({
      opt1: {
        option: true,
        type: defaultTypeConverters.bool,
        isSwitch: true,
      },
      opt2: {
        option: true,
        type: defaultTypeConverters.string,
        isSwitch: false,
        def: "foo",
      },
      opt3: {
        option: true,
        type: defaultTypeConverters.number,
        isSwitch: false,
      },
    });
  });
});
