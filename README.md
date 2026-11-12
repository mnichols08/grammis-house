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

**Changing the decorations:** open **Seasons**. The top says what's up today and when it changes.
- **Change the decorations with the calendar** on: each season goes up and comes down on its
  own days. Change a day with the month and day lists, or **Add a season** for a new holiday.
- Switched off: pick what the site wears under **Your site wears**, and it stays up until you change it.

Then **Save seasons** and **Publish**.

**Customize look** lets you make the writing bigger or smaller, or roomier, for the whole
site. The holiday colors come from the decorations, so that screen leaves them alone on purpose.

## How the decorating works

```
themes/
  grammis/        the house: handwritten brand (Caveat), Fraunces headings, and where
                  every decoration hangs (house.css)
  thanksgiving/   the harvest table: plaid tablecloth, a swag of leaves, wheat and little
                  pumpkins, "Give thanks" bunting, a pumpkin cluster, a mantel of gourds and
                  candles, and leaves that tumble down the home page
  christmas/      a pine garland with red bows, gold ornaments and bulbs that twinkle one
                  by one, a wreath, snow on the welcome card, a snowy village along the
                  bottom, and snowfall; a pine-night version in dark mode
```

`grammis` is the house. Each season `extends` it and changes only **tokens**: colours, the
holiday name (`season`), and five pictures from its `decor/` folder:

| Piece | Hangs | Thanksgiving | Christmas |
| --- | --- | --- | --- |
| `garland` | under the header | leaf-and-wheat swag | pine, bows, lights |
| `banner` | along the top of the welcome card | Give thanks bunting | snow drift |
| `corner` | on the welcome card's corner | pumpkins and gourds | wreath |
| `mantel` | along the top of the footer | gourds and candles | village in the snow |
| `pattern` | behind the page | plaid tablecloth | scattered snowflakes |

The pictures are drawn in code by `scripts/draw_decorations.py`, and
`scripts/decorate.py` turns them into tokens. Decorating never means editing `house.css`.
Leaves, snow and twinkling hold still for anyone whose device asks for less motion,
and recipe pages stay quiet because people are cooking. Phones get the garland, sign and banner, but not the corner piece.

**The house decorates itself.** This is open.blog's `seasons` setting in `openblog.json`
(added in [open.blog#649](https://github.com/journey-to-code-org/open.blog/pull/649)), edited on
Admin's **Seasons** screen:

| Season | Up | Down |
| --- | --- | --- |
| Thanksgiving | Oct 15 | Nov 30 |
| Christmas | Dec 1 | Jan 6 |
| (rest of the year) | `theme`: the plain `grammis` house | |

Every build checks today's date, and the site rebuilds every hour, so a new season shows up within an hour
of its start date. `openblog serve` redecorates by itself at midnight. Days are UTC, so the switch happens
around 7 or 8 pm the evening before on the East Coast.

**Each holiday keeps its own decorations.** Every recipe belongs to a holiday collection
(`content/series/thanksgiving.md`, `christmas.md`), and each collection names its theme. So in
December, the Thanksgiving recipes still have their autumn look while the rest of the house is up for Christmas.

### Adding a season (Easter, Fourth of July, ...)

1. Copy `themes/thanksgiving/` to `themes/<season>/`. In its `theme.json`, change the
   colours and `"season": "\"<Name>\""`. Draw the season's pieces in `decor/` (any of
   the five; leave one out and it isn't hung), then run `python3 scripts/decorate.py <season>`.
2. Add it on the **Seasons** screen (or as a window under `seasons` in `openblog.json`).
3. Add `content/series/<season>.md` with `theme: <season>` for that holiday's recipes.
4. To get a countdown sign for it, teach `themes/grammis/components/holiday-countdown.zb` its date and add it to the sign's **Which holiday** choices in `theme.json` (see below).

## Components (Zubra)

`components/` holds web components written in [Zubra](https://github.com/journey-to-code-org/zubra).
They are compiled to plain custom elements (no runtime, nothing to install) into the `grammis`
theme, which declares each one under `components` in its `theme.json`
([open.blog#651](https://github.com/journey-to-code-org/open.blog/pull/651)). Every season extends
`grammis`, so every season offers them.

**Grammi places them herself.** On **Landing page → Add a section**, the theme's components are
listed after the built-in sections ("Countdown sign: a little hanging sign that counts the days until
the holiday"). The form comes from the settings the theme declares (for the sign, **Which holiday**:
Thanksgiving or Christmas). She can move, hide or delete it like any other section. The preview
shows the component's one-line fallback, because Admin's preview runs no scripts.

To add a component:

1. Write `themes/grammis/components/<name>.zb`, then compile its script and its styles:

   ```sh
   npx -p @zubra/compiler@5.8.0 zubra compile themes/grammis/components/<name>.zb \
     --emit element --output themes/grammis/components/<name>.js
   npx -p @zubra/compiler@5.8.0 zubra compile themes/grammis/components/<name>.zb \
     --emit css > themes/grammis/components/<name>.css
   ```
2. Declare it in `themes/grammis/theme.json` under `components`: a `label` and `description` in
   plain words, the `script`, the `source` (the `.zb`), a one-line `fallback`, and its settings
   (`text`, `choice`, `number` or `toggle`, each with a `label`). Add the `.css` to `stylesheets`.
3. `openblog check`. It now shows up in Admin's **Add a section**.

**Rendered ahead** ([open.blog#652](https://github.com/journey-to-code-org/open.blog/pull/652)): when the
`zubra` command is installed, `openblog build` puts each component's HTML into the page, so the sign is
there before its script runs, for readers without JavaScript, and in Admin's preview. The deploy workflow
installs it. Locally, run `npm i -g @zubra/compiler@5.8.0`, or set
`OPENBLOG_ZUBRA="npx -y @zubra/compiler@5.8.0"`. Without it, the sign still appears once its script runs.

Anything only the browser knows (like today's date) is left for the script. That's why the sign says
"Counting down to Christmas" first and then fills in the number of days.

`themes/grammis/zubra-bridge.css` maps open.blog's `--ob-*` tokens to the shadcn/ui variables
that [Zubra UI](https://github.com/journey-to-code-org/zubra-ui) components read. That means any Zubra UI
component dropped in here follows the current season, in light and dark.

Admin's **Publish** button commits only `content`, `static`, `openblog.json`, `themes` and
`.github`, so commit changes to `components/` and `scripts/` with git.

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
