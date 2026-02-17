---
description: Generate a cover image for an article
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - mcp__nano-banana-agent__GENERATE_IMAGE
---

<objective>
Generate a cover image for an article using the visual style guide. Extract the article's core concept, build a style-compliant prompt, generate the image, and update frontmatter on approval.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/visual-style.md (full guide — prompt template, color palette, conceptual adaptations)
@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise, scan `blog/articles/` for drafts without a `coverImage`, and list them.

2. **Read the article.** Read `blog/articles/{slug}.md` to understand the content and extract the core concept.

3. **Map concept to visual treatment.** Using the Conceptual Adaptations table from `blog/visual-style.md`:

   | Concept | Visual Treatment |
   |---------|-----------------|
   | AI/Technology | Robot heroes, atomic age machines, ray gun aesthetics, circuit patterns |
   | Leadership | Heroic silhouette, dramatic upward angle, cape-like flowing elements |
   | Growth/Progress | Ascending figure, explosive energy lines, breaking through barriers |
   | Philosophy | Contemplative hero pose, cosmic background, thought-bubble styling |
   | Action/Urgency | Speed lines, dynamic poses, explosive halftone bursts |
   | Brazil/Future | Futuristic cityscape, bold skyline, ascending rocket imagery |
   | Writing/Ideas | Typewriter keys, speech bubbles, dramatic pen/quill imagery |

4. **Build the image prompt.** Use the Article Header template from visual-style.md:

```
Create a landscape digital artwork with deep forest green background (hex #1a4d3e).

{Concept-specific description adapted from the article's theme}

Style influences: 1950s-60s Marvel/DC comic books, golden age superhero art, pulp action illustrations, atomic age sci-fi.

Apply heavy digital effects: visible dithering patterns, pixelation artifacts, halftone dots like vintage comic printing, CRT scanline effects, film grain texture.

Bold dramatic composition with strong contrast. Noir lighting with bright lime-green accents (hex #c4e538) as highlights and glowing elements.

Monochromatic green palette only - ranging from very dark forest green to bright lime-green. No other colors.

Gritty, heroic, retro-futuristic aesthetic. Dark but powerful. No text.
```

5. **Generate the image.** Call `mcp__nano-banana-agent__GENERATE_IMAGE` with:
   - `prompt`: The constructed prompt
   - `aspectRatio`: `"3:2"` (close to 1200x630 OG image ratio)
   - `model`: `"gemini-2.5-flash-image-preview"`

6. **Present to user.** Show the generated image and ask for approval. If rejected, ask what to change and regenerate.

7. **On approval:**
   - Save the image to `public/images/articles/{slug}.png`
   - Update `coverImage` in `blog/articles/{slug}.md` frontmatter to `/images/articles/{slug}.png`

8. **Report.**

Output:
```
Image generated and saved:
  - public/images/articles/{slug}.png
  - Frontmatter updated with coverImage path

Next step: /article:publish {slug}
```

</process>

<success_criteria>
- Image is generated using the visual style guide's color palette and effects
- Aspect ratio is 3:2
- Image is saved to `public/images/articles/{slug}.png`
- Article frontmatter `coverImage` is updated to `/images/articles/{slug}.png`
- User explicitly approved the image before saving
</success_criteria>
