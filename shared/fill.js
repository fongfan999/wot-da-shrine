/** A sentence with its {placeholders} filled: fill('{n} praying', { n: 3 }) → "3 praying". Every language's words are filled this way, on the page and in the Worker. */
export const fill = (text, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), text);
