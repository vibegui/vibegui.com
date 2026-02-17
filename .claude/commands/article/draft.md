---
description: Write the full article draft
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

<objective>
Write the complete article to `blog/articles/{slug}.md`, following all planning artifacts and the tone-of-voice guide. Self-review against voice checklist before presenting to user.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/tone-of-voice.md (full guide — especially Section 5 for linguistic patterns, Section 11 for implementation playbook)
@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise, scan `content/briefs/` for directories with all three artifacts (BRIEF.md, RESEARCH.md, OUTLINE.md), and list them.

2. **Read all planning artifacts.**
   - `content/briefs/{slug}/BRIEF.md` — topic, angle, audience, key message
   - `content/briefs/{slug}/RESEARCH.md` — findings, data, sources, contrarian angles
   - `content/briefs/{slug}/OUTLINE.md` — beat structure, hook, closing, voice notes
   - `blog/tone-of-voice.md` — the full voice guide

3. **Read the existing draft skeleton.** Read `blog/articles/{slug}.md` to get current frontmatter.

4. **Write the article.** Follow the outline beat by beat:
   - Open with the hook from the outline (refined if needed)
   - Follow each beat's purpose, key points, and emotional register
   - Incorporate research data and sources naturally
   - Apply the voice patterns from tone-of-voice.md:
     - Short paragraphs (max 3 sentences, often single-sentence)
     - Alternating rhythm: short punches then longer explanation
     - Active verbs, first-person voice
     - Specific examples with names, events, numbers
     - At least one vulnerable moment
     - No hedging language
   - Close using the strategy from the outline

5. **Self-review.** Run through the Section 11.1 checklist:
   - [ ] Opening hook stops the scroll
   - [ ] First-person voice throughout
   - [ ] At least one vulnerable moment (specific, not vague)
   - [ ] A philosophical framework grounds the insight
   - [ ] Short paragraphs (none exceeds 3 sentences)
   - [ ] Active verbs ("I decided," not "It was decided")
   - [ ] Specific examples (named people, events, numbers)
   - [ ] Connects to Brazil's future where relevant
   - [ ] Ends with invitation or grounded statement
   - [ ] No hedging language

6. **Run the Guilherme Voice Test** (Section 11.2):
   - Would he actually say this in conversation?
   - Does it feel like he's in the arena or the stands?
   - Is there something vulnerable and specific?
   - Does it connect to action, not just contemplation?
   - Would it fit on his LinkedIn without feeling off-brand?

7. **Write the article.** Update `blog/articles/{slug}.md` preserving frontmatter, writing full content body. Keep `status: draft`.

8. **Present to user.** Show:
   - Word count
   - Voice checklist results (pass/note for each item)
   - Any areas where you had to make creative decisions beyond the outline
   - Invitation to iterate: "Edit the file directly or tell me what to change."

</process>

<success_criteria>
- Article is written to `blog/articles/{slug}.md` with complete content
- Frontmatter `status` remains `draft`
- All outline beats are covered
- Voice checklist (Section 11.1) passes on all items
- Article reads naturally in Guilherme's voice — not generic AI writing
- Word count is within the range specified in the outline
</success_criteria>
