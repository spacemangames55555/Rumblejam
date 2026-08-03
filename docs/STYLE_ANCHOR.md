# Style anchor

One unit is generated first, approved, and then never re-rolled. Every
subsequent generation reuses its style clause **verbatim**. Consistency drift
across 298 assets is the primary failure mode of the art phase, and this is the
only defence against it.

The anchor is **Pulsar** — close-combat nova character, the reference
implementation of engine-not-multiplier, and the most visually distinctive
thing in the roster.

## Status

**PENDING** — not yet generated. No generator is connected to this environment
(see `docs/ART-GENERATION.md` §1), so batch 0 has not run.

`tools/gen_prompts.mjs` refuses to emit prompts while the clause below is
`PENDING`. That is deliberate: it makes "generate the anchor first" a
mechanical gate rather than a discipline someone has to remember.

## The clause

Everything between the two markers is copied byte-for-byte into every prompt by
`tools/gen_prompts.mjs`. Do not paraphrase it anywhere — paraphrasing *is*
drift, and it is invisible until forty sprites disagree.

<!-- STYLE-CLAUSE-START -->
PENDING
<!-- STYLE-CLAUSE-END -->

## Record, once the anchor is approved

Fill these in and commit in the same change that sets the clause above.

| field | value |
|---|---|
| generator | *(tool + version)* |
| `character_id` / asset id returned | *(pending)* |
| exact final prompt | *(pending — the full string, not a summary)* |
| reference-image parameter used | *(pending — name it, or "none available")* |
| date approved | *(pending)* |
| approved by | *(pending)* |
| seed / determinism knob | *(pending, if the generator exposes one)* |

## The rule

**Never re-roll the anchor once batch 1 begins.** A changed anchor invalidates
every asset generated before it, and there is no cheap way to tell which ones
drifted. If the anchor turns out to be wrong, that is a decision to regenerate
everything downstream of it — make it deliberately, and record it here with the
date and the reason.
