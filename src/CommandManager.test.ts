import { expect } from "chai";
import {CommandManager} from "./CommandManager";
import {CommandMatchError} from "./CommandMatchError";
import {MatchedCommand} from "./types";

describe("CommandManager", () => {
    describe("Argument parsing", () => {
        it("should parse simple arguments", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1> <arg2>');

            const matched = await manager.findMatchingCommand('!foo val1 val2');
            expect(matched).to.not.equal(null);
            expect(matched instanceof CommandMatchError).to.be.false;
            expect(Object.keys((matched as MatchedCommand).args).length).to.equal(2);
            expect((matched as MatchedCommand).args.arg1.value).to.equal('val1');
            expect((matched as MatchedCommand).args.arg2.value).to.equal('val2');
        });

        it("should parse options", async () => {
            const manager = new CommandManager({ prefix: '!' });
            manager.add('foo', '<arg1>', {
                options: [
                    { name: 'option1', shortcut: 'o' },
                    { name: 'option2', shortcut: 'p' },
                    { name: 'option3', shortcut: 't' },
                    { name: 'flag1', shortcut: 'f', flag: true },
                    { name: 'flag2', shortcut: 'l', flag: true },
                    { name: 'flag3', shortcut: 'a', flag: true },
                ]
            });

            const matched = await manager.findMatchingCommand('!foo val1 --option1 optval1 --option2=optval2 -f -lt optval3');

            expect(matched).to.not.equal(null);
            expect(matched instanceof CommandMatchError).to.be.false;

            expect(Object.keys((matched as MatchedCommand).args).length).to.equal(1);
            expect((matched as MatchedCommand).args.arg1.value).to.equal('val1');
            expect((matched as MatchedCommand).opts.option1.value).to.equal('optval1');
            expect((matched as MatchedCommand).opts.option2.value).to.equal('optval2');
            expect((matched as MatchedCommand).opts.option3.value).to.equal('optval3');
            expect((matched as MatchedCommand).opts.flag1.value).to.equal(true);
            expect((matched as MatchedCommand).opts.flag2.value).to.equal(true);
            expect((matched as MatchedCommand).opts.flag3).to.be.undefined;
        });
    });
});