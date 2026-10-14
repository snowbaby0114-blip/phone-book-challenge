// Argument parsing + interactive prompting, with a non-interactive fallback so
// the same scripts can be driven by CI or by a human at a terminal.

import readline from 'node:readline';

/**
 * Read `--name=value` or `--name value` from argv.
 * Returns undefined when the flag is absent.
 */
export function getFlag(argv, name) {
  const prefix = `--${name}`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) return argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    if (arg.startsWith(`${prefix}=`)) return arg.slice(prefix.length + 1);
  }
  return undefined;
}

/** True when `--name` is present in any form. */
export function hasFlag(argv, name) {
  return getFlag(argv, name) !== undefined;
}

/**
 * Reject unrecognised flags. Without this a typo such as `--verison=13` is
 * silently ignored and the script drops into an interactive prompt (or fails
 * for want of a terminal), which reads as a bug in the script.
 */
export function assertKnownFlags(argv, known) {
  const valueOf = new Set();
  for (let i = 0; i < argv.length; i++) {
    if (valueOf.has(i)) continue;
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument "${arg}". Use --flag=value.`);
    const name = arg.slice(2).split('=')[0];
    if (!known.includes(name)) {
      throw new Error(`Unknown option "--${name}". Supported options: ${known.map((k) => `--${k}`).join(', ')}.`);
    }
    // `--flag value` consumes the next argv element.
    if (!arg.includes('=') && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) valueOf.add(i + 1);
  }
}

/** Ask a question on stdin. Throws when stdin is not a TTY and no default exists. */
export async function ask(question, { defaultValue } = {}) {
  if (!process.stdin.isTTY) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Cannot prompt for "${question}" without a terminal. Pass the value as a flag instead.`);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => rl.question(`${question} `, resolve));
    const trimmed = answer.trim();
    if (trimmed === '' && defaultValue !== undefined) return defaultValue;
    return trimmed;
  } finally {
    rl.close();
  }
}

/** Ask until a non-empty answer is given (or a default is available). */
export async function askRequired(question, { defaultValue, attempts = 3 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const answer = await ask(question, { defaultValue });
    if (answer !== '') return answer;
    console.log('  A value is required.');
  }
  throw new Error(`No value provided for "${question}".`);
}
