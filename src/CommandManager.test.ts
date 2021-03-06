import { expect, assert } from "chai";
import { CommandManager } from "./CommandManager";
import { ICommandConfig, isError, IMatchedCommand } from "./types";
import { parseSignature } from "./parseSignature";
import { bool, defaultTypeConverters, number, string, switchOption } from "./defaultTypes";

describe("CommandManager", () => {
  describe("Parameter validation", () => {
    it("Deny multiple rest parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", parseSignature("<arg1...> <arg2...>"));
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny multiple catch-all parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", parseSignature("<arg1$> <arg2$>"));
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny rest + catch-all", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", parseSignature("<arg1...> <arg2$>"));
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny multiple optional parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", parseSignature("[arg1] [arg2]"));
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny optional parameter followed by required parameter", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", parseSignature("[arg1] <arg2>"));
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Validate all given signatures", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        // The first set of parameters is valid, but the second overload has an invalid type
        manager.add("foo", [parseSignature("<bar:string>"), parseSignature("<bar:unknownType>")]);
      } catch (e) {
        return;
      }

      assert.fail();
    });
  });

  describe("Argument parsing", () => {
    it("Simple arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1> <arg2>"));

      const matched = await manager.findMatchingCommand("!foo val1 val2");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.equal("val2");
    });

    it("Rest arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg:number...>"));

      const matched = await manager.findMatchingCommand("!foo 20 720");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(1);
      expect(matched.values.arg.value).to.eql([20, 720]);
    });

    it("Options (default prefixes)", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        arg1: string(),

        option1: string({ option: true, shortcut: "o" }),
        option2: string({ option: true, shortcut: "p" }),
        option3: string({ option: true, shortcut: "t" }),
        option4: string({ option: true, shortcut: "i" }),
        switch1: switchOption({ shortcut: "f" }),
        switch2: switchOption({ shortcut: "a" }),
      });

      const matched = await manager.findMatchingCommand(
        "!foo val1 --option1 optval1 --option2=optval2 -f -t optval3 -i=optval4",
      );

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.option1.value).to.equal("optval1");
      expect(matched.values.option2.value).to.equal("optval2");
      expect(matched.values.option3.value).to.equal("optval3");
      expect(matched.values.option4.value).to.equal("optval4");
      expect(matched.values.switch1.value).to.equal(true);
      expect(matched.values.switch2).to.be.undefined;
    });

    it("- and -- are interchangeable for options/option shortcuts", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        arg1: string(),

        option1: string({ option: true, shortcut: "o" }),
        option2: string({ option: true, shortcut: "p" }),
        option3: string({ option: true, shortcut: "t" }),
        option4: string({ option: true, shortcut: "i" }),
        switch1: switchOption({ shortcut: "f" }),
        switch2: switchOption({ shortcut: "a" }),
      });

      const matched = await manager.findMatchingCommand(
        "!foo val1 -option1 optval1 -option2=optval2 --f --t optval3 --i=optval4",
      );

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.option1.value).to.equal("optval1");
      expect(matched.values.option2.value).to.equal("optval2");
      expect(matched.values.option3.value).to.equal("optval3");
      expect(matched.values.option4.value).to.equal("optval4");
      expect(matched.values.switch1.value).to.equal(true);
      expect(matched.values.switch2).to.be.undefined;
    });

    it("Custom option prefixes", async () => {
      const manager = new CommandManager({
        prefix: "!",
        optionPrefixes: ["/"],
      });
      manager.add("foo", {
        option1: string({ option: true, shortcut: "o" }),
        option2: string({ option: true, shortcut: "o2" }),
      });

      const matched = await manager.findMatchingCommand("!foo /option1 optvalue1 /o2 optvalue2");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(matched.values.option1.value).to.equal("optvalue1");
      expect(matched.values.option2.value).to.equal("optvalue2");

      const nonMatching = await manager.findMatchingCommand("!foo -option1 optvalue1");

      if (nonMatching === null) return assert.fail();
      if (nonMatching.error === undefined) return assert.fail(); // This should fail
    });

    it("Proper matching order for custom option prefixes", async () => {
      // Option prefixes should be matched starting from the longest so that if a long prefix contains a shorter one at
      // the start, the shorter one isn't matched instead of the longer one
      const manager = new CommandManager({
        prefix: "!",
        optionPrefixes: ["-", "----"],
      });
      manager.add("foo", {
        option1: string({ option: true, shortcut: "o" }),
      });

      const matched = await manager.findMatchingCommand("!foo ----option1=optvalue1");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(matched.values.option1.value).to.equal("optvalue1");
    });

    it("[DEPRECATION] Do not support combined option shortcuts (-abcd)", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        switch1: switchOption({ shortcut: "a" }),
        switch2: switchOption({ shortcut: "b" }),
        switch3: switchOption({ shortcut: "c" }),
      });

      const matched = await manager.findMatchingCommand("!foo -abc");

      if (matched === null) return assert.fail();
      if (!isError(matched)) return assert.fail("-abc option should have been rejected");
    });

    it("Rest arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1> <arg2...>"));

      const matched = await manager.findMatchingCommand("!foo val1 val2 val3");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.eql(["val2", "val3"]);
    });

    it("Catch-all arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1> <arg2$>"));

      const matched = await manager.findMatchingCommand("!foo val1 val2 val3");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.equal("val2 val3");
    });

    it("Default values", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1> [arg2=val2]"));

      const matched = await manager.findMatchingCommand("!foo val1");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.equal("val2");
    });

    it("Quoted arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1> <arg2> <arg3>"));

      const matched = await manager.findMatchingCommand("!foo val1 \"val2 val3\" 'val4 val5'");
      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.equal("val2 val3");
      expect(matched.values.arg3.value).to.equal("val4 val5");
    });

    it("Deny too many arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1>"));

      const matched = await manager.findMatchingCommand("!foo val1 val2");
      if (matched === null) return assert.fail();
      if (!isError(matched)) return assert.fail();
    });

    it("Deny unknown options", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", []);

      const matched = await manager.findMatchingCommand("!foo --opt=val");
      if (matched === null) return assert.fail();
      if (!isError(matched)) return assert.fail();
    });

    it("Ignore options within catch-all/rest", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg$>"));
      manager.add("bar", parseSignature("<arg...>"));

      const matched1 = await manager.findMatchingCommand("!foo blah blah --unknown=val blah");
      if (matched1 === null) return assert.fail();
      if (isError(matched1)) return assert.fail(matched1.error);

      const matched2 = await manager.findMatchingCommand("!bar blah blah --unknown=val blah");
      if (matched2 === null) return assert.fail();
      if (isError(matched2)) return assert.fail(matched2.error);
    });

    it("Match option at the start of a catch-all/rest", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        ...parseSignature("<arg$>"),
        opt: string({ option: true }),
      });
      manager.add("bar", {
        ...parseSignature("<arg...>"),
        opt: string({ option: true }),
      });

      const matched1 = await manager.findMatchingCommand("!foo --opt=val blah blah");
      if (matched1 === null) return assert.fail();
      if (isError(matched1)) return assert.fail(matched1.error);
      expect(matched1.values.arg.value).to.equal("blah blah");
      expect(matched1.values.opt.value).to.equal("val");

      const matched2 = await manager.findMatchingCommand("!bar --opt=val blah blah");
      if (matched2 === null) return assert.fail();
      if (isError(matched2)) return assert.fail(matched2.error);
      expect(matched2.values.arg.value).to.eql(["blah", "blah"]);
      expect(matched2.values.opt.value).to.equal("val");
    });

    it("Don't match options in quotes", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        ...parseSignature("[arg]"),
        opt: string({ option: true }),
      });

      const matched1 = await manager.findMatchingCommand("!foo --opt=val");
      if (matched1 === null) return assert.fail();
      if (isError(matched1)) return assert.fail(matched1.error);
      expect(matched1.values.arg).to.equal(undefined);
      expect(matched1.values.opt.value).to.equal("val");

      const matched2 = await manager.findMatchingCommand("!foo '--opt=val'");
      if (matched2 === null) return assert.fail();
      if (isError(matched2)) return assert.fail(matched2.error);
      expect(matched2.values.arg.value).to.equal("--opt=val");
      expect(matched2.values.opt).to.equal(undefined);
    });

    it("[DEPRECATION] No longer support ending parameter parsing with -- and treating everything afterwards as if it was quoted", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg>"));

      const matched = await manager.findMatchingCommand("!foo -- this will be in arg");
      if (matched === null) return assert.fail();
      if (!isError(matched)) return assert.fail();
    });

    it("Should not include leading spaces in a first argument catch-all", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg$>"));

      const matched = await manager.findMatchingCommand("!foo test");
      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);
      expect(matched.values.arg.value).to.equal("test");
    });

    it("[EDGE CASE] Should not interpret options with quotes as arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        ...parseSignature("<arg$>"),
        opt: string({ option: true }),
      });

      const matched = await manager.findMatchingCommand('!foo -opt="value" bar');
      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);
      expect(matched.values.arg.value).to.equal("bar");
      expect(matched.values.opt.value).to.equal("value");
    });
  });

  describe("Argument/option types", () => {
    it("Default types", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", parseSignature("<arg1:string> <arg2:number>"));

      const matched = await manager.findMatchingCommand("!foo val1 504");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal("val1");
      expect(matched.values.arg2.value).to.equal(504);
    });

    it("Custom types", async () => {
      const types = {
        static(value) {
          return 5;
        },
        reversed(value) {
          return [...value].reverse().join("");
        },
      };
      const manager = new CommandManager({
        prefix: "!",
      });
      manager.add("foo", parseSignature("<arg1:static> <arg2:reversed>", types, "static"));

      const matched = await manager.findMatchingCommand("!foo val1 hello");

      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);

      expect(Object.keys(matched.values).length).to.equal(2);
      expect(matched.values.arg1.value).to.equal(5);
      expect(matched.values.arg2.value).to.equal("olleh");
    });

    it("Custom types with context", async () => {
      const types = {
        custom(value, context) {
          return context.num;
        },
      };

      const manager = new CommandManager<{ num: number }>({
        prefix: "!",
      });
      manager.add("foo", parseSignature("<arg1:custom>", types, "custom"));

      const matched1 = await manager.findMatchingCommand("!foo thisdoesntmatter", { num: 5 });
      if (matched1 === null) return assert.fail();
      if (isError(matched1)) return assert.fail(matched1.error);
      expect(matched1.values.arg1.value).to.equal(5);

      const matched2 = await manager.findMatchingCommand("!foo itjusthastobethere", { num: 20 });
      if (matched2 === null) return assert.fail();
      if (isError(matched2)) return assert.fail(matched2.error);
      expect(matched2.values.arg1.value).to.equal(20);
    });

    it("Async types", async () => {
      const types = {
        asyncNumber(value) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(Number(value));
            }, 10);
          });
        },
      };
      const manager = new CommandManager({
        prefix: "!",
      });
      manager.add("foo", parseSignature("<arg:asyncNumber>", types, "asyncNumber"));

      const matched = await manager.findMatchingCommand("!foo 50");
      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);
      expect(Object.keys(matched.values).length).to.equal(1);
      expect(matched.values.arg.value).to.equal(50);
    });

    it("Async type for rest argument", async () => {
      const types = {
        asyncNumber(value) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(Number(value));
            }, 10);
          });
        },
      };
      const manager = new CommandManager({
        prefix: "!",
      });
      manager.add("foo", parseSignature("<arg:asyncNumber...>", types, "asyncNumber"));

      const matched = await manager.findMatchingCommand("!foo 50 1 820");
      if (matched === null) return assert.fail();
      if (isError(matched)) return assert.fail(matched.error);
      expect(Object.keys(matched.values).length).to.equal(1);
      expect(matched.values.arg.value).to.eql([50, 1, 820]);
    });

    it("Valid default type", () => {
      // Default type ("string") should not be found in the empty types object
      try {
        const manager = new CommandManager({
          prefix: "!",
        });
        manager.add("foo", parseSignature("<foo>", {}));
      } catch (e) {
        return;
      }

      assert.fail("Non-existent default type should've been rejected");
    });
  });

  describe("Filters", () => {
    it("Pre-filters", async () => {
      const manager = new CommandManager({ prefix: "!" });

      const filter = (command) => command.triggers[0].source.indexOf("foo") === -1;

      // This should never match
      manager.add("foo", [], {
        preFilters: [filter],
      });

      // This should match
      manager.add("bar", [], {
        preFilters: [filter],
      });

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 !== null) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!bar");
      if (matched2 === null || matched2.error) return assert.fail();
    });

    it("Post-filters", async () => {
      const manager = new CommandManager({ prefix: "!" });

      const filter = (matchedCommand) => matchedCommand.values.arg1.value === "foo";

      manager.add("foo", parseSignature("<arg1>"), {
        postFilters: [filter],
      });

      const matched1 = await manager.findMatchingCommand("!foo foo");
      if (matched1 === null) return assert.fail();
      if (isError(matched1)) return assert.fail(matched1.error);

      const matched2 = await manager.findMatchingCommand("!foo bar");
      if (matched2 !== null) return assert.fail();
    });
  });

  describe("Misc", () => {
    it("Aliases", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add(["foo", "bar", "baz"], parseSignature("<arg1:string> <arg2:number>"));

      const matched1 = await manager.findMatchingCommand("!foo val1 50");
      if (matched1 === null || matched1.error !== undefined) return assert.fail(matched1 && matched1.error);

      const matched2 = await manager.findMatchingCommand("!bar val1 50");
      if (matched2 === null || matched2.error !== undefined) return assert.fail(matched2 && matched2.error);

      const matched3 = await manager.findMatchingCommand("!baz val1 50");
      if (matched3 === null || matched3.error !== undefined) return assert.fail(matched3 && matched3.error);
    });

    it("Regex trigger", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add(/foo|bar|baz/);

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 === null || matched1.error !== undefined) return assert.fail(matched1 && matched1.error);

      const matched2 = await manager.findMatchingCommand("!bar");
      if (matched2 === null || matched2.error !== undefined) return assert.fail(matched2 && matched2.error);

      const matched3 = await manager.findMatchingCommand("!baz");
      if (matched3 === null || matched3.error !== undefined) return assert.fail(matched3 && matched3.error);
    });

    it("Regex prefix", async () => {
      const manager = new CommandManager({ prefix: /!+/ });
      manager.add("foo");

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 === null || matched1.error !== undefined) return assert.fail(matched1 && matched1.error);

      const matched2 = await manager.findMatchingCommand("!!foo");
      if (matched2 === null || matched2.error !== undefined) return assert.fail(matched2 && matched2.error);

      const matched3 = await manager.findMatchingCommand("!!!foo");
      if (matched3 === null || matched3.error !== undefined) return assert.fail(matched3 && matched3.error);

      const matched4 = await manager.findMatchingCommand("foo");
      if (matched4 !== null) return assert.fail();
    });

    it("Filter context", async () => {
      type FilterContext = { foo: string };
      const manager = new CommandManager<FilterContext>({ prefix: "!" });

      manager.add("foo", [], {
        preFilters: [(cmd, context) => context.foo === "one"],
        postFilters: [(cmd, context) => context.foo === "one"],
      });

      // This should pass
      const matched1 = await manager.findMatchingCommand("!foo", { foo: "one" });
      if (matched1 === null || matched1.error !== undefined) assert.fail();

      // This should not pass
      const matched2 = await manager.findMatchingCommand("!foo", { foo: "two" });
      if (matched2 !== null) assert.fail();
    });

    it("Should pick the first fitting signature", async () => {
      const manager = new CommandManager({ prefix: "!" });
      const cmd1 = manager.add("foo", parseSignature("<arg1:string> <arg2:number>"));
      const cmd2 = manager.add("foo", parseSignature("<arg1:number> <arg2:string>"));
      const cmd3 = manager.add("foo", parseSignature("<arg1:string> <arg2:string>"));

      const matched1 = await manager.findMatchingCommand("!foo val 5");
      if (matched1 === null || matched1.error !== undefined) return assert.fail(matched1 && matched1.error);
      expect(matched1.id).to.equal(cmd1.id);

      const matched2 = await manager.findMatchingCommand("!foo 5 val2");
      if (matched2 === null || matched2.error !== undefined) return assert.fail(matched2 && matched2.error);
      expect(matched2.id).to.equal(cmd2.id);

      const matched3 = await manager.findMatchingCommand("!foo val1 val2");
      if (matched3 === null || matched3.error !== undefined) return assert.fail(matched3 && matched3.error);
      expect(matched3.id).to.equal(cmd3.id);
    });

    it("Should increment command IDs", async () => {
      const manager = new CommandManager({ prefix: "!" });
      const cmd1 = manager.add("foo", parseSignature("<arg1:string> <arg2:number>"));
      const cmd2 = manager.add("foo", parseSignature("<arg1:number> <arg2:string>"));
      const cmd3 = manager.add("foo", parseSignature("<arg1:string> <arg2:string>"));

      expect(cmd1.id).to.equal(1);
      expect(cmd2.id).to.equal(2);
      expect(cmd3.id).to.equal(3);
    });

    it("Should only match prefixes and triggers at the start", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("r");

      const matched1 = await manager.findMatchingCommand("a!foo");
      if (matched1 !== null) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!foor");
      if (matched2 !== null) return assert.fail();
    });

    it("Should only match triggers followed by whitespace or end of string", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("s", parseSignature("<arg>"));
      manager.add("suspend");

      const matched1 = await manager.findMatchingCommand("!suspend");
      if (matched1 === null || matched1.error !== undefined) return assert.fail(matched1 && matched1.error);

      const matched2 = await manager.findMatchingCommand("!suspendo");
      if (matched2 !== null) return assert.fail();
    });

    it("Should pass command config to command definition", async () => {
      const manager = new CommandManager({ prefix: "!" });
      const command = manager.add("foo", [], {
        extra: null,
      });
      expect(command.config).to.eql({ extra: null });
    });

    it("Should support TConfigExtra types", async () => {
      type Extra = {
        foobar: string;
      };

      const manager = new CommandManager<null, Extra>({ prefix: "!" });
      const command = manager.add("foo", [], {
        extra: {
          foobar: "blah",
        },
      });

      if (command.config) {
        expect(command.config.extra).to.eql({ foobar: "blah" });
      } else {
        assert.fail();
      }
    });

    it("Should return the relevant command with match errors", async () => {
      const manager = new CommandManager<null, { num: number }>({ prefix: "!" });
      manager.add("foo", parseSignature("<bar:number>"), {
        extra: {
          num: 1,
        },
      });
      manager.add("foo", parseSignature("<bar:number>"), {
        extra: {
          num: 2,
        },
      });

      const matchResult = await manager.findMatchingCommand("!foo blah");
      if (!matchResult || matchResult.error == null) return assert.fail();
      if (matchResult.command.config == null || matchResult.command.config.extra == null) return assert.fail();
      // Always the last command we tried to match and encountered an error in
      expect(matchResult.command.config.extra.num).to.equal(2);
    });

    it("getAll()", async () => {
      const manager = new CommandManager({ prefix: "!" });
      const def1 = manager.add("foo");
      const def2 = manager.add("bar");

      const definitions1 = manager.getAll();
      expect(definitions1.length).to.equal(2);
      expect(definitions1[0]).to.equal(def1);
      expect(definitions1[1]).to.equal(def2);

      manager.remove(def1.id);
      expect(definitions1.length).to.equal(2); // The earlier array returned by getAll() should not be modified

      const definitions2 = manager.getAll();
      expect(definitions2.length).to.equal(1);
      expect(definitions2[0]).to.equal(def2);
    });

    it("Match correct overload/signature", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", [parseSignature("<bar:number>"), parseSignature("<baz:string>")]);

      const matched1 = await manager.findMatchingCommand("!foo 10");
      if (!matched1 || isError(matched1)) return assert.fail();
      expect(matched1.values.bar).to.exist;
      expect(matched1.values.baz).to.not.exist;
      expect(matched1.values.bar.value).to.equal(10);

      const matched2 = await manager.findMatchingCommand("!foo test");
      if (!matched2 || isError(matched2)) return assert.fail();
      expect(matched2.values.bar).to.not.exist;
      expect(matched2.values.baz).to.exist;
      expect(matched2.values.baz.value).to.equal("test");
    });

    it("Complex prefix", async () => {
      const manager = new CommandManager({ prefix: "!" });
    });

    it("Original prefix exists", async () => {
      const originalStringPrefix = "!";
      const manager = new CommandManager({ prefix: originalStringPrefix });
      expect((manager.getDefaultPrefix() as RegExp).source).to.equal("^!");
      expect(manager.getOriginalDefaultPrefix()).to.equal(originalStringPrefix);

      const originalRegExpPrefix = /[ab]/;
      const manager2 = new CommandManager({ prefix: originalRegExpPrefix });
      expect((manager2.getDefaultPrefix() as RegExp).source).to.equal("^[ab]");
      expect(manager2.getOriginalDefaultPrefix()).to.equal(originalRegExpPrefix);

      const manager3 = new CommandManager({ prefix: originalStringPrefix });
      manager3.add("foo");

      const matchedCommand = await manager3.findMatchingCommand("!foo");
      if (matchedCommand == null) return assert.fail();
      if (matchedCommand.error != null) return assert.fail(matchedCommand.error);
      expect(matchedCommand.originalPrefix).to.equal("!");
      expect((matchedCommand.prefix as RegExp).source).to.equal("^!");
    });

    it("Type helpers", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", {
        str: string(),
        num: number(),
      });

      const matched = await manager.findMatchingCommand("!foo bar 50");
      if (matched == null || isError(matched)) assert.fail(matched && matched.error);
    });
  });
});
