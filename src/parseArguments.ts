const whitespace = /\s/;

export type TParsedArguments = Array<{ index: number; value: string; quoted: boolean }>;

const quoteChars = ["'", '"'];

export function parseArguments(str: string): TParsedArguments {
  const args: Array<{ index: number; value: string; quoted: boolean }> = [];
  const chars = [...str]; // Unicode split

  let index = 0;
  let current = "";
  let escape = false;
  let inQuote: string | null = null;
  let startedWithQuote = false;

  const flushCurrent = (newIndex: number, quoted = false) => {
    const argIndex = index;
    index = newIndex;

    if (current === "") {
      return;
    }

    args.push({ index: argIndex, value: current, quoted });
    current = "";
  };

  for (const [i, char] of chars.entries()) {
    if (escape) {
      current += char;
      escape = false;
    } else if (whitespace.test(char) && inQuote === null) {
      flushCurrent(i + 1);
    } else if (quoteChars.includes(char)) {
      if (inQuote === null) {
        inQuote = char;
        if (current === "") {
          startedWithQuote = true;
        }
      } else if (inQuote === char) {
        flushCurrent(i + 1, startedWithQuote);
        inQuote = null;
        startedWithQuote = false;
      } else {
        current += char;
      }
    } else if (char === "\\") {
      escape = true;
    } else {
      current += char;
    }
  }

  if (current !== "") {
    flushCurrent(0);
  }

  return args;
}
