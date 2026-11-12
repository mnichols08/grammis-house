# Spike: Zubra, a component composer, and describing a theme in words

**Question.** Should open.blog bring in [Zubra](https://github.com/journey-to-code-org/zubra) and
[Zubra UI](https://github.com/journey-to-code-org/zubra-ui) so that an author with no coding skills can
add components to their site, and describe a theme in plain words?

**Short answer.** Yes, in three steps. The first step works today and is already in this repo.
The rest should be driven by what Grammi actually asks for. Grammi will never write a `.zb` file.
For her, Zubra is how *we* build things she can choose from, not something she authors.

## What this repo already proves (no engine changes)

| Piece | Where | What it shows |
| --- | --- | --- |
| A Zubra component | `components/holiday-countdown.zb` | Written in `.zb`, compiled with `zubra compile --emit element` to an 8 KB custom element with no runtime and no dependencies |
| Shipped as a theme script | `themes/grammis/decorations.js` | Theme `scripts` can import it, because open.blog copies the whole theme folder |
| Themed by the season | `themes/grammis/zubra-bridge.css` | Maps `--ob-*` tokens to shadcn's `--primary`, `--card`, `--border`, `--radius`… so **any Zubra UI component follows the current season**, in light and dark |
| Driven by tokens | `--ob-season` | The sign reads the holiday from the active theme, so switching the season changes the countdown too |

The bridge matters most. open.blog themes are JSON with `extends` that compile to CSS variables.
Zubra UI theme sets are also JSON with `extends`, compiled to scoped CSS variables. The two are the
same idea under different names, and about 20 lines of CSS connect them.

## What the spike ran into

1. **There's no place in the page to put a component.** Landing sections rightly refuse markup,
   and the heading wrapper is the theme's only hook into the markup. The sign had to be inserted
   by script, so it appears only after JavaScript runs.
2. **A developer has to compile components.** Grammi can't add one from Admin.
3. **Version floor.** The `zubra` crate needs Rust **1.97**, and open.blog promises **1.85**.
4. **Dependency weight.** The Zubra compiler pulls in `oxc_*`. open.blog's README makes a point of
   having few dependencies.
5. **Maturity.** Zubra says it has no production users yet. Grammi's House would be the first, which
   makes it a good place to try it, and a reason to keep Zubra optional.

## Proposal

### Step 1: a component kit, kept in this repo first

You suggested a separate toolkit repository. I'd start it as a folder here and move it out once a
second site needs it, so its format is shaped by real use, not guesses. It holds:

- **`zubra-bridge.css`**, generated from a theme's tokens (today it's written by hand).
- **A small set of components chosen for blogs**, compiled to plain elements: `holiday-countdown`,
  Zubra UI's `image-gallery` (with `zubra-imager` for recipe photos), `accordion-panel` for
  "Grammi's notes", and `star-rating` for "the family's favourite".
- **A manifest for each component** describing its props for Admin, in the shape the composer already uses:

```json
{ "tag": "holiday-countdown", "label": "Countdown sign",
  "description": "Days until the holiday, under the garland.",
  "props": { "holiday": { "type": "choice", "choices": ["thanksgiving", "christmas"], "label": "Which holiday" } },
  "places": ["landing", "post"] }
```

That manifest is the contract everything after this builds on.

### Step 2: components as a landing section and a Markdown block (engine)

- A landing section type `component` with `{ "tag": "...", "props": { ... } }`. It's accepted only
  for a tag registered in a theme's manifest, and only with props that match the manifest's types.
  That keeps the landing page's "no markup, ever" rule: the author picks from a menu and fills
  in a form.
- The same thing as a fence in posts, like the existing `quote` and `compare` fences:

  ````markdown
  ```component holiday-countdown
  holiday: christmas
  ```
  ````

- **Server HTML at build time** behind a cargo feature (`--features zubra`):
  `zubra::compile_value(source, &props)` returns the element's server-rendered HTML, so the page reads
  correctly without JavaScript, as every open.blog feature does today. Without the feature, the
  build writes the bare element and the precompiled script upgrades it. That keeps the 1.85
  floor and the light dependency list for everyone else.

### Step 3: the composer and "describe your theme" (Admin)

**Composer.** Don't build a second page editor. Admin's Landing page screen is already a composer:
cards, add, move, hide, preview at Phone/Tablet/Desktop. Zubra UI's `compose.js` follows the same
model. Add the manifest's components to **Add a section**, with a settings form generated from
`props`. Grammi then sees "Countdown sign · Which holiday: Christmas", never a tag name.

**Decorations screen.** For a seasonal site, this sits on top: the Seasons feature from the field
notes (finding 1), plus a toggle for each decoration in the active theme (garland, falling leaves, countdown sign).
Each toggle is a registered component, or a token like `garland: none`.

**Describe your theme in words.** "Warm like my kitchen at Christmas, deep red and pine green,
a little gold, big easy-to-read writing." What the Assistant would do:

1. Write a **theme.json only**: colours for light and dark, fonts from a safe list, and tokens.
   Never CSS or JS. That keeps the rule already in the themes doc ("Nothing an owner types can
   reach the stylesheet") and makes the output checkable.
2. Check it with the engine's own compiler (`themeCss` in the WASM module) and a WCAG AA contrast
   check, as Zubra UI's theme studio already does, adjusting colours just enough and saying so in words.
3. Pick decorations **from the registered components and garland library**, not invent them.
4. Show it in Customize look's existing live preview, then save it as `themes/<name>/` with
   `extends: grammis`.

It fits the Assistant's existing structure: `crates/openblog-cli/src/assistant_skills/` holds
Markdown skills, so this becomes a `theme-design.md` skill with the token list and the house's rules.
Voice samples (already planned) tell it how Grammi writes; a theme brief tells it how her house looks.

## Suggested order

1. **Seasons in the engine** (field notes, finding 1). Grammi needs it most, and it's small.
2. **The component manifest + `component` landing section**, with `holiday-countdown` as the first entry.
   This replaces the script injection here.
3. **Build-time server HTML** behind `--features zubra`.
4. **Describe-your-theme** as an Assistant skill on top of Customize look.
5. Move the kit to its own repository once a second site uses it.

## Open questions

- Should components belong to a theme (and change with it) or to the site? Decorations suggest
  the theme. A photo gallery suggests the site.
- Would Zubra lower its floor to Rust 1.85, or would open.blog raise its own to 1.97? A feature flag avoids the question for now.
- Who reviews AI-made themes before they go live? A JSON-only theme can be checked by the
  machine. A component can't, which is why the AI should pick components and never write them.
