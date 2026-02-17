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
Write the complete article to `blog/articles/{slug}.md`, following all planning artifacts and the tone-of-voice guide. Write, then revise against the voice guide in a separate pass. Present the revised version to the user.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/tone-of-voice.md (full guide — especially Section 3.3 for AI-speak slop, Section 5 for linguistic patterns, Section 11 for implementation playbook)
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

4. **Write the first draft.** Follow the outline beat by beat:
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
     - **Kill AI-speak slop.** Watch for these patterns and rewrite them:
       - ❌ "No X. No Y. Just Z." → tricolon summaries are a dead giveaway of LLM writing
       - ❌ "This isn't X. It's Y." → defensive reframing that nobody asked for
       - ❌ "Let's dive in" / "Here's the thing" / "At its core" / "It's worth noting"
       - ❌ Unnecessarily tidy parallel structures ("X gives it hands. Y gives it a brain.")
       - ❌ Any sentence that sounds like a LinkedIn carousel slide
       - ✅ Instead: write like you're explaining it to a friend over coffee — messy, specific, human
   - Close using the strategy from the outline
   - Save to `blog/articles/{slug}.md`

5. **Revision pass — re-read and rewrite.** This is a SEPARATE step, not a mental checklist. Actually do it:
   - Re-read `blog/tone-of-voice.md` (especially Sections 3.3, 5, and 11)
   - Re-read the draft you just wrote in `blog/articles/{slug}.md`
   - Go through the article paragraph by paragraph and ask:
     - Does this sentence sound like something Guilherme would actually say out loud?
     - Is this a tidy, packaged AI structure? (parallel punchlines, tricolons, defensive reframes)
     - Could this sentence appear in any LinkedIn post by any person? If yes, it's not his voice — rewrite it
     - Are there filler transitions? ("But here's where it gets interesting", "This is where the magic happens", "Let me be honest") — cut them
     - Are consecutive paragraphs starting with the same structure? Break the pattern
   - **Rewrite every sentence that fails these checks.** Don't just flag them — fix them in the file.
   - This pass typically improves the article significantly. The first draft captures the structure and information; the revision pass makes it sound human.

6. **Self-review checklist.** After the revision pass, verify (Section 11.1):
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
   - [ ] Zero AI-speak slop (Section 3.3)

7. **Run the Guilherme Voice Test** (Section 11.2):
   - Would he actually say this in conversation?
   - Does it feel like he's in the arena or the stands?
   - Is there something vulnerable and specific?
   - Does it connect to action, not just contemplation?
   - Would it fit on his LinkedIn without feeling off-brand?

8. **Present to user.** Show:
   - Word count
   - Voice checklist results (pass/note for each item)
   - Notable changes made during the revision pass (so the user can see what was caught)
   - Invitation to iterate: "Edit the file directly or tell me what to change."

</process>

<success_criteria>
- Article is written to `blog/articles/{slug}.md` with complete content
- Frontmatter `status` remains `draft`
- All outline beats are covered
- A revision pass was performed AFTER the first draft — not just a checklist, an actual re-read and rewrite
- Voice checklist (Section 11.1) passes on all items
- Article reads naturally in Guilherme's voice — not generic AI writing
- Zero AI-speak slop: no tricolons, no defensive reframes, no LinkedIn carousel cadence, no filler transitions
- Word count is within the range specified in the outline
</success_criteria>
