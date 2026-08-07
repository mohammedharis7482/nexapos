/**
 * Direction handling for second-language text.
 *
 * Scope is deliberately narrow (see `docs/planned-features.md`): only the
 * elements that render a secondary name get a direction. Layout mirroring,
 * RTL navigation, tables, reports, icon flipping and a global `dir` on
 * `<html>` are explicitly out of scope. Primary names, UI chrome, numbers,
 * money and quantities stay LTR.
 */

/**
 * The `dir` for an element holding a secondary name.
 *
 * `auto` rather than a hard-coded `rtl` (the spec permits either): the browser
 * infers direction from the text's own first strong character, so a name typed
 * in a script that does not match the shop's configured language still renders
 * correctly, and a shop that has not set a secondary language needs no
 * plumbing at all. Returns `undefined` for empty text so the attribute is
 * omitted entirely rather than rendered on nothing.
 */
export function secondaryNameDir(text: string | null | undefined): "auto" | undefined {
  return text ? "auto" : undefined;
}
