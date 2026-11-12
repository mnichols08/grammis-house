# Grammi's House

Grammi's kitchen, open all year: her famous holiday recipes and family stories, decorated
for every season. Built with [open.blog](https://github.com/journey-to-code-org/open.blog).

The idea: the kids and grandkids have all moved out, so the recipes they grew up on live
here. The site gets decorated for the season the way the real house does. Thanksgiving
is up first, and Christmas is ready to go.

## For Grammi: writing and changing recipes

Everything is done in the editor in your web browser. You never have to touch a file.

1. Open the editor (`/admin`) and sign in.
2. **Posts** lists every recipe. Tap one to open it. It reads like a word processor:
   - Under **Ingredients**, start each line with the amount (`2 cups flour`). That lets
     the family make half or double a recipe with one tap.
   - Under **Steps**, write times the way you'd say them (`bake for 45 minutes`). Readers
     get a timer button for each one.
3. **Settings** (above the recipe) holds servings, prep and cook time, and the photo.
   It also has **Draft / Published**: a recipe stays private until you switch it to
   Published.
4. **Save**, then **Publish** (top right) to put it on the site.
5. **New recipe** on the Overview screen starts a new one with everything ready to fill in.

**Changing the decorations:** open **Pages → Decorations → Settings** and choose a season under
**Theme** (Thanksgiving, Christmas, or No decorations), then **Save** and **Publish**. **Site preview**
shows the decorations before you publish. The whole house changes within a few minutes of publishing.
Set Theme back to **Inherit** and the calendar takes over again.

**Customize look** lets you make the writing bigger or smaller, or roomier, for the whole
site. The holiday colors come from the decorations, so that screen leaves them alone on purpose.

## How the decorating works

```
themes/
  grammis/        the house itself: layout, fonts, the garland hook, the countdown sign
  thanksgiving/   autumn colors, a leaf-and-acorn garland, a few falling leaves
  christmas/      red and evergreen, twinkling lights, a little snow
```

`grammis` is the house. Each season `extends` it and changes only **tokens** in its
`theme.json`: colors, the garland picture (`garland`), and the holiday name (`season`).
Decorating never means editing the house's stylesheet.

**The house decorates itself, unless Grammi says otherwise.** The deploy workflow runs
`scripts/season.py` before each build and sets `"theme"` in `openblog.json` from, in order:

1. the Theme picked on the **Decorations** page in Admin (`content/pages/decorations.md`);
2. `"pin"` in [`seasons.json`](seasons.json);
3. the calendar in `seasons.json`;
4. `"default"` (the plain house).

The calendar:

| Season | Up | Down |
| --- | --- | --- |
| Thanksgiving | Oct 15 | Nov 30 |
| Christmas | Dec 1 | Jan 6 |
| (rest of the year) | plain `grammis` house | |

The site rebuilds every hour, so a new season shows up within an hour of its start date.
open.blog's Admin has no site-wide theme setting yet (see the field notes), which is why the
Decorations page's own Theme dropdown acts as the switch. `openblog serve` doesn't run the
script, so locally the whole site changes only after you run it. To try another date:

```sh
python3 scripts/season.py --date 12-10   # sets "theme" in openblog.json
openblog serve
```

**Each holiday keeps its own decorations.** Every recipe belongs to a holiday collection
(`content/series/thanksgiving.md`, `christmas.md`), and each collection names its theme. So in
December, the Thanksgiving recipes still have their autumn look while the rest of the house is up for Christmas.

### Adding a season (Easter, Fourth of July, ...)

1. Copy `themes/thanksgiving/` to `themes/<season>/`. In its `theme.json`, change the
   colors and `"season": "\"<Name>\""`. Draw the season's `garland.svg`
   and run `python3 scripts/garland.py <season>` to hang it.
2. Add a window to `seasons.json`.
3. Add `content/series/<season>.md` with `theme: <season>` for that holiday's recipes.
4. To get a countdown sign for it, teach `components/holiday-countdown.zb` the date (see below).

## Components (Zubra)

`components/` holds web components written in [Zubra](https://github.com/journey-to-code-org/zubra).
They are compiled to plain custom elements (no runtime, nothing to install) and shipped as
ordinary theme scripts, so open.blog needs no changes to use them.

```sh
npx -p @zubra/compiler@5.8.0 zubra compile components/holiday-countdown.zb \
  --emit element --output themes/grammis/components/holiday-countdown.js
```

`themes/grammis/zubra-bridge.css` maps open.blog's `--ob-*` tokens to the shadcn/ui variables
that [Zubra UI](https://github.com/journey-to-code-org/zubra-ui) components read. That means any Zubra UI
component dropped in here follows the current season, in light and dark.

Admin's **Publish** button commits only `content`, `static`, `openblog.json`, `themes` and
`.github`, so commit changes to `components/`, `scripts/` and `seasons.json` with git.

## Running it

```sh
cargo install --git https://github.com/journey-to-code-org/open.blog --rev d18b32aa49904c9425d19b5bf9b5e210384a65af openblog-cli
openblog serve --drafts           # http://localhost:8080/grammis-house/ (drafts included)
openblog user add grammi          # once, to create a login
openblog serve --admin            # editor at http://localhost:8080/admin
```

The site deploys to GitHub Pages on every push to `main` (Settings → Pages → Source: **GitHub
Actions**). The workflow pins the open.blog version (`OPENBLOG_REV`), so upgrades happen on purpose.

## Notes

- [`docs/open-blog-field-notes.md`](docs/open-blog-field-notes.md): what using open.blog as a
  real user turned up (bugs, friction, and what worked well).
- [`docs/spike-zubra-composer.md`](docs/spike-zubra-composer.md): the plan for Zubra, a
  component composer, and describing a theme in plain words.
