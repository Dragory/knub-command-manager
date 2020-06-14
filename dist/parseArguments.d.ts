export declare type TParsedArguments = Array<{
  index: number;
  value: string;
  quoted: boolean;
}>;
export declare function parseArguments(str: string): TParsedArguments;
