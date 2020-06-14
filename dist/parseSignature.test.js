"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const parseSignature_1 = require("./parseSignature");
const defaultTypes_1 = require("./defaultTypes");
chai_1.config.truncateThreshold = 0;
describe("parseSignature", () => {
    it("Parse single required parameter", () => {
        const result = parseSignature_1.parseSignature("<str>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.string,
            required: true,
        });
    });
    it("Parse single required typed parameter", () => {
        const result = parseSignature_1.parseSignature("<str:number>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.number,
            required: true,
        });
    });
    it("Parse single required parameter with default value", () => {
        const result = parseSignature_1.parseSignature("<str=10>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.string,
            required: true,
            def: "10",
        });
    });
    it("Parse single required typed parameter with default value", () => {
        const result = parseSignature_1.parseSignature("<str:number=10>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.number,
            required: true,
            def: "10",
        });
    });
    it("Parse single optional parameter", () => {
        const result = parseSignature_1.parseSignature("[str]");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.string,
            required: false,
        });
    });
    it("Parse single catch-all parameter", () => {
        const result = parseSignature_1.parseSignature("<str$>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.string,
            required: true,
            catchAll: true,
        });
    });
    it("Parse single rest parameter", () => {
        const result = parseSignature_1.parseSignature("<str...>");
        chai_1.expect(result.str).to.eql({
            option: false,
            type: defaultTypes_1.defaultTypeConverters.string,
            required: true,
            rest: true,
        });
    });
    it("Parse single switch option", () => {
        const result = parseSignature_1.parseSignature("-opt");
        chai_1.expect(result.opt).to.eql({
            option: true,
            type: defaultTypes_1.defaultTypeConverters.bool,
            isSwitch: true,
        });
    });
    it("Parse single typed option", () => {
        const result = parseSignature_1.parseSignature("-opt:string");
        chai_1.expect(result.opt).to.eql({
            option: true,
            type: defaultTypes_1.defaultTypeConverters.string,
            isSwitch: false,
        });
    });
    it("Parse single switch option with default value", () => {
        const result = parseSignature_1.parseSignature("-opt=1");
        chai_1.expect(result.opt).to.eql({
            option: true,
            type: defaultTypes_1.defaultTypeConverters.bool,
            isSwitch: true,
            def: "1",
        });
    });
    it("Parse single switch option with default value", () => {
        const result = parseSignature_1.parseSignature("-opt:string=hello");
        chai_1.expect(result.opt).to.eql({
            option: true,
            type: defaultTypes_1.defaultTypeConverters.string,
            isSwitch: false,
            def: "hello",
        });
    });
    it("Parse option with shortcut", () => {
        const result = parseSignature_1.parseSignature("-opt|o:string=hi");
        chai_1.expect(result.opt).to.eql({
            option: true,
            type: defaultTypes_1.defaultTypeConverters.string,
            isSwitch: false,
            shortcut: "o",
            def: "hi",
        });
    });
    it("Parse multiple parameters", () => {
        const result = parseSignature_1.parseSignature("<arg1:string> <arg2:number>");
        chai_1.expect(result).to.eql({
            arg1: {
                option: false,
                type: defaultTypes_1.defaultTypeConverters.string,
                required: true,
            },
            arg2: {
                option: false,
                type: defaultTypes_1.defaultTypeConverters.number,
                required: true,
            },
        });
    });
    it("Parse multiple options", () => {
        const result = parseSignature_1.parseSignature("-opt1 -opt2:string=foo -opt3:number");
        chai_1.expect(result).to.eql({
            opt1: {
                option: true,
                type: defaultTypes_1.defaultTypeConverters.bool,
                isSwitch: true,
            },
            opt2: {
                option: true,
                type: defaultTypes_1.defaultTypeConverters.string,
                isSwitch: false,
                def: "foo",
            },
            opt3: {
                option: true,
                type: defaultTypes_1.defaultTypeConverters.number,
                isSwitch: false,
            },
        });
    });
});
