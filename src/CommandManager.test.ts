import { expect, assert } from "chai";
import {CommandManager} from "./CommandManager";
import {CommandMatchError} from "./CommandMatchError";
import {MatchedCommand} from "./types";

describe("CommandManager", () => {
    describe("Parameter validation", () => {
        it("Deny multiple rest arguments", () => {
            const manager = new CommandManager({ prefix: '!' });

            try {
                manager.add('foo', '<arg1...> <arg2...>');
            } catch (e) {
                return;
            }

            assert.fail();
        });

        it("Deny multiple catch-all arguments", () => {
            const manager = new CommandManager({ prefix: '!' });

            try {
                manager.add('foo', '<arg1$> <arg2$>');
            } catch (e) {
                return;
            }

            assert.fail();
        });

        it("Deny rest + catch-all", () => {
            const manager = new CommandManager({ prefix: '!' });

            try {
                manager.add('foo', '<arg1...> <arg2$>');
            } catch (e) {
                return;
            }

            assert.fail();
        });

        it("Deny multiple optional parameters", () => {
            const manager = new CommandManager({ prefix: '!' });

            try {
                manager.add('foo', '[arg1] [arg2]');
            } catch (e) {
                return;
            }

            assert.fail();
        });

        it("Deny optional parameter followed by required parameter", () => {
            const manager = new CommandManager({ prefix: '!' });

            try {
                manager.add('foo', '[arg1] <arg2>');
            } catch (e) {
                return;
            }

            assert.fail();
        });
    });

    describe("Argument parsing", () => {
        it("Simple arguments", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> <arg2>');

            const matched = await manager.findMatchingCommand('!foo val1 val2');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.args.arg2.value).to.equal('val2');
        });

        it("Options", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1>', {
                options: [
                    { name: 'option1', shortcut: 'o' },
                    { name: 'option2', shortcut: 'p' },
                    { name: 'option3', shortcut: 't' },
                    { name: 'option4', shortcut: 'i' },
                    { name: 'flag1', shortcut: 'f', flag: true },
                    { name: 'flag2', shortcut: 'l', flag: true },
                    { name: 'flag3', shortcut: 'a', flag: true },
                ]
            });

            const matched = await manager.findMatchingCommand('!foo val1 --option1 optval1 --option2=optval2 -f -lt optval3 -i=optval4');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.opts.option1.value).to.equal('optval1');
            expect(matched.opts.option2.value).to.equal('optval2');
            expect(matched.opts.option3.value).to.equal('optval3');
            expect(matched.opts.option4.value).to.equal('optval4');
            expect(matched.opts.flag1.value).to.equal(true);
            expect(matched.opts.flag2.value).to.equal(true);
            expect(matched.opts.flag3).to.be.undefined;
        });

        it("Rest arguments", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> <arg2...>');

            const matched = await manager.findMatchingCommand('!foo val1 val2 val3');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.args.arg2.value).to.eql(['val2', 'val3']);
        });

        it("Catch-all arguments", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> <arg2$>');

            const matched = await manager.findMatchingCommand('!foo val1 val2 val3');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.args.arg2.value).to.equal('val2 val3');
        });

        it("Default values", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> [arg2=val2]');

            const matched = await manager.findMatchingCommand('!foo val1');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.args.arg2.value).to.equal('val2');
        });

        it("Deny too many arguments", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> ');

            const matched = await manager.findMatchingCommand('!foo val1 val2');
            if (matched === null || !matched.error) return assert.fail();
        });

        it("Deny unknown options", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', []);

            const matched = await manager.findMatchingCommand('!foo --opt=val');
            if (matched === null || !matched.error) return assert.fail();
        });
    });

    describe("Types", () => {
        it("Default types", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1:string> <arg2:number>');

            const matched = await manager.findMatchingCommand('!foo val1 504');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal('val1');
            expect(matched.args.arg2.value).to.equal(504);
        });

        it("Custom types", async () => {
            const manager = new CommandManager({
                prefix: '!',
                types: {
                    static(value) {
                        return 5;
                    },
                    reversed(value) {
                        return [...value].reverse().join('');
                    }
                },
                defaultType: "static"
            });
            manager.add('foo', '<arg1:static> <arg2:reversed>');

            const matched = await manager.findMatchingCommand('!foo val1 hello');

            if (matched === null) return assert.fail();
            if (matched.error !== undefined) return assert.fail();

            expect(Object.keys(matched.args).length).to.equal(2);
            expect(matched.args.arg1.value).to.equal(5);
            expect(matched.args.arg2.value).to.equal('olleh');
        });

        it("Valid default type", () => {
            // Default type ("string") should not be found in the empty types object
            try {
                const manager = new CommandManager({
                    prefix: '!',
                    types: {}
                });
            } catch (e) {
                return;
            }

            assert.fail();
        });
    });

    describe("Misc", () => {
        it("Aliases", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1:string> <arg2:number>', {
                aliases: ['bar', 'baz']
            });

            const matched1 = await manager.findMatchingCommand('!foo val1 50');
            if (matched1 === null || matched1.error !== undefined) return assert.fail();

            const matched2 = await manager.findMatchingCommand('!bar val1 50');
            if (matched2 === null || matched2.error !== undefined) return assert.fail();

            const matched3 = await manager.findMatchingCommand('!baz val1 50');
            if (matched3 === null || matched3.error !== undefined) return assert.fail();
        });

        it("Regex trigger", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add(/foo|bar|baz/);

            const matched1 = await manager.findMatchingCommand('!foo');
            if (matched1 === null || matched1.error !== undefined) return assert.fail();

            const matched2 = await manager.findMatchingCommand('!bar');
            if (matched2 === null || matched2.error !== undefined) return assert.fail();

            const matched3 = await manager.findMatchingCommand('!baz');
            if (matched3 === null || matched3.error !== undefined) return assert.fail();
        });

        it("Regex prefix", async () => {
            const manager = new CommandManager({ prefix: /!+/ });
            manager.add('foo');

            const matched1 = await manager.findMatchingCommand('!foo');
            if (matched1 === null || matched1.error !== undefined) return assert.fail();

            const matched2 = await manager.findMatchingCommand('!!foo');
            if (matched2 === null || matched2.error !== undefined) return assert.fail();

            const matched3 = await manager.findMatchingCommand('!!!foo');
            if (matched3 === null || matched3.error !== undefined) return assert.fail();

            const matched4 = await manager.findMatchingCommand('foo');
            if (matched4 !== null) return assert.fail();
        });
    });
});