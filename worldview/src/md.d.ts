// Markdown imported as text. Wired by the `rules` block in wrangler.jsonc so
// prose lives in .md files instead of escaped JSON strings.
declare module "*.md" {
  const content: string;
  export default content;
}
