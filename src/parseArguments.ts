const whitespace = /\s/;

export type TParsedArguments = Array<{ index: number; value: string; quoted: boolean }>;

export function parseArguments(str: string): TParsedArguments {
  const args: Array<{ index: number; value: string; quoted: boolean }> = [];
  const chars = [...str]; // Unicode split

  let index = 0;
  let current = "";
  let escape = false;
  let inQuote: string | null = null;

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
      continue;
    } else if (whitespace.test(char) && inQuote === null) {
      flushCurrent(i + 1);
    } else if (char === `'` || char === `"`) {
      if (inQuote === null) {
        inQuote = char;
      } else if (inQuote === char) {
        flushCurrent(i + 1, true);
        inQuote = null;
        continue;
      } else {
        current += char;
      }
    } else if (!inQuote && char === "-" && chars.slice(i - 1, 4).join("") === " -- ") {
      current = chars.slice(i + 3).join("");
      flushCurrent(0, true);
      break;
    } else {
      current += char;
    }
  }

  if (current !== "") {
    flushCurrent(0);
  }

  return args;
}
