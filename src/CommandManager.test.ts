import { expect, assert } from "chai";
import { CommandManager } from "./CommandManager";
import { MatchedCommand } from "./types";

describe("CommandManager", () => {
  describe("Parameter validation", () => {
    it("Deny multiple rest parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", "<arg1...> <arg2...>");
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny multiple catch-all parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", "<arg1$> <arg2$>");
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny rest + catch-all", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", "<arg1...> <arg2$>");
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny multiple optional parameters", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", "[arg1] [arg2]");
      } catch (e) {
        return;
      }

      assert.fail();
    });

    it("Deny optional parameter followed by required parameter", () => {
      const manager = new CommandManager({ prefix: "!" });

      try {
        manager.add("foo", "[arg1] <arg2>");
      } catch (e) {
        return;
      }

      assert.fail();
    });
  });

  describe("Argument parsing", () => {
    it("Simple arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> <arg2>");

      const matched = await manager.findMatchingCommand("!foo val1 val2");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.equal("val2");
    });

    it("Options", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1>", {
        options: [
          { name: "option1", shortcut: "o" },
          { name: "option2", shortcut: "p" },
          { name: "option3", shortcut: "t" },
          { name: "option4", shortcut: "i" },
          { name: "flag1", shortcut: "f", flag: true },
          { name: "flag2", shortcut: "l", flag: true },
          { name: "flag3", shortcut: "a", flag: true }
        ]
      });

      const matched = await manager.findMatchingCommand(
        "!foo val1 --option1 optval1 --option2=optval2 -f -lt optval3 -i=optval4"
      );

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.opts.option1.value).to.equal("optval1");
      expect(matched.opts.option2.value).to.equal("optval2");
      expect(matched.opts.option3.value).to.equal("optval3");
      expect(matched.opts.option4.value).to.equal("optval4");
      expect(matched.opts.flag1.value).to.equal(true);
      expect(matched.opts.flag2.value).to.equal(true);
      expect(matched.opts.flag3).to.be.undefined;
    });

    it("Rest arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> <arg2...>");

      const matched = await manager.findMatchingCommand("!foo val1 val2 val3");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.eql(["val2", "val3"]);
    });

    it("Catch-all arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> <arg2$>");

      const matched = await manager.findMatchingCommand("!foo val1 val2 val3");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.equal("val2 val3");
    });

    it("Default values", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> [arg2=val2]");

      const matched = await manager.findMatchingCommand("!foo val1");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.equal("val2");
    });

    it("Quoted arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> <arg2> <arg3>");

      const matched = await manager.findMatchingCommand("!foo val1 \"val2 val3\" 'val4 val5'");
      if (matched === null || matched.error !== undefined) return assert.fail();
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.equal("val2 val3");
      expect(matched.args.arg3.value).to.equal("val4 val5");
    });

    it("Deny too many arguments", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1> ");

      const matched = await manager.findMatchingCommand("!foo val1 val2");
      if (matched === null || !matched.error) return assert.fail();
    });

    it("Deny unknown options", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", []);

      const matched = await manager.findMatchingCommand("!foo --opt=val");
      if (matched === null || !matched.error) return assert.fail();
    });

    it("Ignore options within catch-all/rest", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg$>");
      manager.add("bar", "<arg...>");

      const matched1 = await manager.findMatchingCommand("!foo blah blah --unknown=val blah");
      if (matched1 === null || matched1.error) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!bar blah blah --unknown=val blah");
      if (matched2 === null || matched2.error) return assert.fail();
    });

    it("Match option at the start of a catch-all/rest", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg$>", {
        options: [{ name: "opt" }]
      });
      manager.add("bar", "<arg...>", {
        options: [{ name: "opt" }]
      });

      const matched1 = await manager.findMatchingCommand("!foo --opt=val blah blah");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();
      expect(matched1.args.arg.value).to.equal("blah blah");
      expect(matched1.opts.opt.value).to.equal("val");

      const matched2 = await manager.findMatchingCommand("!bar --opt=val blah blah");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();
      expect(matched2.args.arg.value).to.eql(["blah", "blah"]);
      expect(matched2.opts.opt.value).to.equal("val");
    });

    it("Don't match options in quotes", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "[arg]", {
        options: [{ name: "opt" }]
      });

      const matched1 = await manager.findMatchingCommand("!foo --opt=val");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();
      expect(matched1.args.arg).to.equal(undefined);
      expect(matched1.opts.opt.value).to.equal("val");

      const matched2 = await manager.findMatchingCommand("!foo '--opt=val'");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();
      expect(matched2.args.arg.value).to.equal("--opt=val");
      expect(matched2.opts.opt).to.equal(undefined);
    });

    it("Supports ending parameter parsing with -- and treating everything afterwards as if it was quoted", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg>");

      const matched1 = await manager.findMatchingCommand("!foo -- this will be in arg");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();
      expect(matched1.args.arg.value).to.equal("this will be in arg");
    });
  });

  describe("Types", () => {
    it("Default types", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1:string> <arg2:number>");

      const matched = await manager.findMatchingCommand("!foo val1 504");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal("val1");
      expect(matched.args.arg2.value).to.equal(504);
    });

    it("Custom types", async () => {
      const manager = new CommandManager({
        prefix: "!",
        types: {
          static(value) {
            return 5;
          },
          reversed(value) {
            return [...value].reverse().join("");
          }
        },
        defaultType: "static"
      });
      manager.add("foo", "<arg1:static> <arg2:reversed>");

      const matched = await manager.findMatchingCommand("!foo val1 hello");

      if (matched === null) return assert.fail();
      if (matched.error !== undefined) return assert.fail();

      expect(Object.keys(matched.args).length).to.equal(2);
      expect(matched.args.arg1.value).to.equal(5);
      expect(matched.args.arg2.value).to.equal("olleh");
    });

    it("Valid default type", () => {
      // Default type ("string") should not be found in the empty types object
      try {
        const manager = new CommandManager({
          prefix: "!",
          types: {}
        });
      } catch (e) {
        return;
      }

      assert.fail();
    });
  });

  describe("Filters", () => {
    it("Pre-filters", async () => {
      const manager = new CommandManager({ prefix: "!" });

      const filter = command => command.triggers[0].source.indexOf("foo") === -1;

      // This should never match
      manager.add("foo", [], {
        preFilters: [filter]
      });

      // This should match
      manager.add("bar", [], {
        preFilters: [filter]
      });

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 !== null) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!bar");
      if (matched2 === null || matched2.error) return assert.fail();
    });

    it("Post-filters", async () => {
      const manager = new CommandManager({ prefix: "!" });

      const filter = matchedCommand => matchedCommand.args.arg1.value === "foo";

      manager.add("foo", "<arg1>", {
        postFilters: [filter]
      });

      const matched1 = await manager.findMatchingCommand("!foo foo");
      if (matched1 === null || matched1.error) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!foo bar");
      if (matched2 !== null) return assert.fail();
    });
  });

  describe("Misc", () => {
    it("Aliases", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add("foo", "<arg1:string> <arg2:number>", {
        aliases: ["bar", "baz"]
      });

      const matched1 = await manager.findMatchingCommand("!foo val1 50");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!bar val1 50");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();

      const matched3 = await manager.findMatchingCommand("!baz val1 50");
      if (matched3 === null || matched3.error !== undefined) return assert.fail();
    });

    it("Regex trigger", async () => {
      const manager = new CommandManager({ prefix: "!" });
      manager.add(/foo|bar|baz/);

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!bar");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();

      const matched3 = await manager.findMatchingCommand("!baz");
      if (matched3 === null || matched3.error !== undefined) return assert.fail();
    });

    it("Regex prefix", async () => {
      const manager = new CommandManager({ prefix: /!+/ });
      manager.add("foo");

      const matched1 = await manager.findMatchingCommand("!foo");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!!foo");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();

      const matched3 = await manager.findMatchingCommand("!!!foo");
      if (matched3 === null || matched3.error !== undefined) return assert.fail();

      const matched4 = await manager.findMatchingCommand("foo");
      if (matched4 !== null) return assert.fail();
    });

    it("Filter context", async () => {
      type FilterContext = { foo: string };
      const manager = new CommandManager<FilterContext>({ prefix: "!" });

      manager.add("foo", [], {
        preFilters: [(cmd, context) => context.foo === "one"]
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
      const cmd1 = manager.add("foo", "<arg1:string> <arg2:number>");
      const cmd2 = manager.add("foo", "<arg1:number> <arg2:string>");
      const cmd3 = manager.add("foo", "<arg1:string> <arg2:string>");

      const matched1 = await manager.findMatchingCommand("!foo val 5");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();
      expect(matched1.id).to.equal(cmd1.id);

      const matched2 = await manager.findMatchingCommand("!foo 5 val2");
      if (matched2 === null || matched2.error !== undefined) return assert.fail();
      expect(matched2.id).to.equal(cmd2.id);

      const matched3 = await manager.findMatchingCommand("!foo val1 val2");
      if (matched3 === null || matched3.error !== undefined) return assert.fail();
      expect(matched3.id).to.equal(cmd3.id);
    });

    it("Should increment command IDs", async () => {
      const manager = new CommandManager({ prefix: "!" });
      const cmd1 = manager.add("foo", "<arg1:string> <arg2:number>");
      const cmd2 = manager.add("foo", "<arg1:number> <arg2:string>");
      const cmd3 = manager.add("foo", "<arg1:string> <arg2:string>");

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
      manager.add("s", "<arg>");
      manager.add("suspend");

      const matched1 = await manager.findMatchingCommand("!suspend");
      if (matched1 === null || matched1.error !== undefined) return assert.fail();

      const matched2 = await manager.findMatchingCommand("!suspendo");
      if (matched2 !== null) return assert.fail();
    });
  });
});
