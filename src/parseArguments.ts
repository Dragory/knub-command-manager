const whitespace = /\s/;

export function parseArguments(str: string): Array<{ index: number; value: string; quoted: boolean }> {
  const args: Array<{ index: number; value: string; quoted: boolean }> = [];
  const chars = [...str]; // Unicode split

  let index = 0;
  let current = "";
  let escape = false;
  let inQuote: string | null = null;

  const flushCurrent = (newIndex: number, quoted = false) => {
    if (current === "") {
      return;
    }

    args.push({ index, value: current, quoted });
    current = "";
    index = newIndex;
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
