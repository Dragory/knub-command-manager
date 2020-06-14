"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const parseArguments_1 = require("./parseArguments");
describe("parseArguments", () => {
    it("Correct index for first argument preceded by whitespace", () => {
        const result = parseArguments_1.parseArguments(" test");
        chai_1.expect(result[0].index).to.equal(1);
    });
    it("Supports escaping", () => {
        const result = parseArguments_1.parseArguments("foo 'bar \\' baz' quux");
        chai_1.expect(result.length).to.equal(3);
        chai_1.expect(result[1].value).to.equal("bar ' baz");
    });
});
