import { expect, assert } from "chai";
import { parseArguments } from "./parseArguments";

describe("parseArguments", () => {
  it("Correct index for first argument preceded by whitespace", () => {
    const result = parseArguments(" test");
    expect(result[0].index).to.equal(1);
  });

  it("Supports escaping", () => {
    const result = parseArguments("foo 'bar \\' baz' quux");
    expect(result.length).to.equal(3);
    expect(result[1].value).to.equal("bar ' baz");
  });
});
