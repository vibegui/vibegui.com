---
description: Create a beat-by-beat article outline
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Write
  - Glob
---

<objective>
Create a detailed beat-by-beat outline for an article, following the structural blueprints from the tone-of-voice guide. Produces `content/briefs/{slug}/OUTLINE.md`.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/tone-of-voice.md (Section 3 for hooks, Section 4 for structural blueprints, Section 6 for emotional arcs)
@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise, scan `content/briefs/` for directories that have `BRIEF.md` and `RESEARCH.md` but no `OUTLINE.md`, and list them.

2. **Read planning artifacts.**
   - Read `content/briefs/{slug}/BRIEF.md` for topic, angle, type, audience, key message
   - Read `content/briefs/{slug}/RESEARCH.md` for findings, data, contrarian angles
   - Read `blog/tone-of-voice.md` for structural patterns

3. **Select the structural blueprint.** Based on the article type from the brief:
   - **Short-form** → Section 4.1 (Hook → Develop → Turn → Invite/Close)
   - **Long-form** → Section 4.2 (Opening Arc → Honest Assessment → Lessons → People → Forward Look)
   - **Technical** → Section 4.3 (Setup → The Build → Lessons → Meta-Reflection)

4. **Select the emotional arc.** From Section 6.1:
   - Pattern A: Confession → Insight → Invitation
   - Pattern B: Provocation → Reframe → Declaration
   - Pattern C: Story → Weight → Urgency

5. **Write the outline.** Create `content/briefs/{slug}/OUTLINE.md`:

```markdown
# Outline: {Title}

**Slug**: {slug}
**Structure**: {blueprint name from Section 4}
**Emotional Arc**: {pattern from Section 6.1}
**Target Length**: {word count range}

## Beats

### Beat 1: {Name} — {Purpose}
- **What happens**: {Description of this section}
- **Key points**: {Bullet points of content to include}
- **Emotional register**: {How the reader should feel}
- **Research to use**: {Specific findings/data from RESEARCH.md}
- **~Words**: {approximate word count}

### Beat 2: {Name} — {Purpose}
...

### Beat N: {Name} — {Purpose}
...

## Hook Selection
**Chosen hook type**: {Pattern from Section 3.1}
**Draft hook**: "{Actual opening line or two}"

## Closing Strategy
**Chosen close type**: {Pattern from Section 9.1}
**Draft close**: "{Sketch of closing line}"

## Voice Notes
{Any specific tone-of-voice considerations for this article — e.g., "lean heavier on vulnerability here" or "keep the philosophical references to Unger only"}
```

6. **Report and suggest next step.**

Output:
```
Outline complete:
  - content/briefs/{slug}/OUTLINE.md
  - {N} beats planned
  - Structure: {blueprint}
  - Emotional arc: {pattern}

Next step: /article:draft {slug}
```

</process>

<success_criteria>
- Outline file exists at `content/briefs/{slug}/OUTLINE.md`
- Uses a structural blueprint from tone-of-voice.md Section 4
- Each beat has: purpose, key points, emotional register, and approximate word count
- Hook is selected from Section 3.1 patterns (not generic)
- Closing strategy uses Section 9.1 patterns
- Total word count across beats is appropriate for the article type
</success_criteria>
