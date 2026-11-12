# open.blog field notes: Grammi's House

Grammi's House is the first site built on open.blog for a non-technical author. I used the
engine the way its README tells a new user to, and noted what got in the way. Tested on
open.blog v0.56.0 (`d18b32aa`), Rust 1.97, Linux, Chrome, on 2026-11-12.

## What worked well

- **Install and init** worked first time from the README: `cargo install --git …` (about 7 minutes
  cold) and `openblog init --github-pages`.
- **The recipe profile is excellent** and needed no setup: summary card, scaling servings, ingredient
  and step checklists, timers, cook mode, print, and recipe structured data. Admin puts
  **New recipe** first under Quick create.
- **Admin's default view is simple** (Overview, Posts, Pages, Series, Landing page, Customize look),
  and the visual editor feels like a word processor. Editing an ingredient list and saving produced
  clean Markdown.
- **The theme system did everything the seasonal design needed with no engine changes**:
  - `extends` chains (`base > grammis > thanksgiving`) link the parent's stylesheets and scripts first;
  - custom tokens take arbitrary values, so a garland can be an SVG data URI token (`--ob-garland`);
  - a series' `theme` keeps that holiday's look on its recipes whatever the site theme is;
  - the whole theme folder is copied, so a theme script can `import "./components/x.js"`.
- **Customize look's preview** renders the real page, including theme decorations.
- `openblog themes` shows inheritance clearly, and `openblog check` is fast and specific.

## Findings

Ordered by how much they affect a non-technical author.

### 1. Admin can't change the site theme (the season): fixed in open.blog#649

`theme` in `openblog.json` could be changed only by editing the file, and nothing changed it by date.
[open.blog#649](https://github.com/journey-to-code-org/open.blog/pull/649) adds a `seasons` setting
(calendar windows that each put up a theme, with `theme` as the look between them) and an Admin
**Seasons** screen that chooses the site theme and turns the calendar on (ADR 0407). This site uses it,
pinned to that PR's commit until it's merged. It replaced a `scripts/season.py` workaround here.

### 2. `openblog serve` commits to git on startup

The first `openblog serve` in a fresh repo with **no commits** created an `analytics` branch and
committed `Analytics backup <time>` using whatever git identity the machine had. On this
machine that identity was not the site owner's. Nothing said this would happen. Suggestions:
skip the backup when there are no views to save, ask once (or require
`analytics.backup: true`), and never commit without a configured `user.name`.

### 3. Saving in Admin rewrites the whole front matter

Changing one ingredient and saving produced this diff:

```diff
-date: 2026-11-01
-draft: true
+slug: roast-turkey
+date: 2026-11-01T00:00:00Z
+draft: "true"          # a boolean became a string
-cover: ""             # dropped
```

The keys were reordered too, and the blank line before `## Ingredients` was removed. The post
still builds as a draft, so nothing broke. But every save makes a noisy diff for anyone reviewing
in git, and `"true"` as a string is a trap for other tools. The Business facts screen already edits
one key as text (ADR 0307); posts could do the same.

### 4. `openblog new "Grammi's Turkey"` makes the slug `grammi-s-turkey`

The apostrophe is treated as a word break. Dropping apostrophes would give `grammis-turkey`,
which matters for a site whose name has one.

### 5. `openblog new --recipe` makes a *published* post full of sample ingredients

The file has no `draft: true`, and its ingredients are flour, salt and milk. One Publish
(or `publish.auto`) puts a fake recipe live. New posts made from the CLI should start as drafts.

### 6. An unknown landing-section field is silently ignored

`{"type": "welcome", "text": "…"}` passes `openblog check` without a word, and the text never
shows. The field is `subheading` (`crates/openblog-core/src/landing.rs:531` has the list). The docs
say a landing page is "accepted whole or not at all", so an unknown field should at least warn and suggest the right one.

### 7. HTML comments are flagged as raw HTML for accessibility review

`<!-- TODO -->` in a post gives `accessibility needs-review … [raw-html-review]`. A comment
renders nothing, so it shouldn't be flagged.

### 8. The starter doesn't fit a non-developer site

`openblog init` writes about 85 component files (Rust runner, git sandbox, server labs, …) into a
recipe blog, and `hello-world.md` contains a `rust runnable` block. Admin already has a
**Recipes** landing layout, so `openblog init --starter recipes` could write a recipe post, the
Recipes landing page, and recipe-relevant navigation, and skip the developer labs.

### 9. The generated Pages workflow isn't pinned, and its cache key claims it is

The workflow runs `cargo install --git …` from `main` HEAD, but caches the binary under
`openblog-<os>-0.56.0`. The first build's binary is then reused indefinitely whatever `main`
becomes, and a cache miss quietly installs a newer engine than the key says. It should write
`--rev <the commit that ran init>` and key the cache on it. This repo does that (`OPENBLOG_REV`).

### 10. Smaller things

- `fonts` in `theme.json` emits only `body`, `heading` and `mono`. A fourth family (`"hand"`) is dropped
  without a warning, so this repo declares it as a token (`fontHand`) instead.
- `openblog init --help` prints the full command list rather than help for `init`.
- `publish.paths` defaults to `content`, `static`, `openblog.json`, `themes`, `.github`. A site
  with its own folders (`components/`, `scripts/`) has to remember that Admin's Publish skips them.
- Customize look applies to every theme. That's right for most sites, but on a seasonal site, picking an accent
  flattens every season's colours. `customizable` handles it (this repo allows `textSize`,
  `spacing` and `pageWidth` only). That's worth one sentence in the themes doc.
- The Theme dropdown shows each theme's full `label`, including the starter `Base`. A
  `"hidden": true` (or `"selectable": false`) on a theme would keep root themes out of the author's list.
- Admin is served at `/admin` while the site is under `/grammis-house/`. That's fine, but worth a line in the
  output of `serve` for project sites.
- With twelve months and six collection looks, the Theme lists hold nineteen entries in one flat list.
  This repo starts the collection looks' labels with "Series:" so they sort together. A `group` on a
  theme (shown as an `<optgroup>`) would do it properly, and **Seasons** could offer only the
  site-wide ones.
- Parent scripts are inherited, so one `weather.js` in the house serves every month, switched by a
  token. Reading a token from a script is just `getComputedStyle(...).getPropertyValue("--ob-weather")`,
  which is worth a line in the themes doc: it's how a theme gives its scripts settings.
- A season whose theme exists but can't be resolved was reported as "there is no
  themes/<name>/theme.json" (a component setting named `once` tripped the `on…` rule, and every
  season extends the house). Fixed in #655: the message now gives the theme's own problem.
- Component settings had no date or post types, so an anniversary countdown or a birthday card
  linking to a recipe meant typing `1986-06-14` and a post address by hand. Added `date` (#654) and
  `post` (#655).
- Zubra refuses `data:` URLs in `src` (a sensible guard), so a component's little pictures go in its
  stylesheet as CSS backgrounds instead.
