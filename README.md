# Grammi's House

Grammi's kitchen, open all year: her famous holiday recipes and family stories, decorated
for every season. Built with [open.blog](https://github.com/journey-to-code-org/open.blog).

The idea: the kids and grandkids have all moved out, so the recipes they grew up on live
here. The site gets decorated for the season the way the real house does: something new up
every month of the year, with Thanksgiving and Christmas the biggest of all.

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

**Dressing up a recipe collection:** every collection (Thanksgiving, Christmas, or a new one) can
wear its own look, whatever month it is. Open the collection under **Series**, pick its **Theme**,
then **Save** and **Publish**. The looks made for collections all start with "Series:" (Recipe box,
Family stories, Garden journal, Baking day, Letters to the grandkids, Sunday dinner).

**The countdown sign** under the garland counts down to whichever holiday comes next, all year,
by itself. Open **Landing page**, then the sign, to change it:
- **Counting down to**: a holiday, or **A day of my own** for an anniversary, a birthday, a visit.
  Then fill in **Your day's name** ("our anniversary") and **Its date** from the calendar. For a day
  that comes every year, pick the very first one (the wedding day) and the sign says "the 41st!".
- **It only happens once** for a one-time day; **A line under it** for anything you want to add.
- **Looks like**: a hanging sign, or a calendar page with a big number.
- Want two? **Add a section** and pick **Countdown sign** again.

## For the family

- **Birthdays.** The family's birthdays are private, so they aren't on the site. Keep them in
  **Greeting cards** (under Family), where only you can see them, and send a birthday card from
  there. The **Birthday card** section still exists (**Add a section → Birthday card**), but
  anything you put in it, the birth date included, is public: anyone can read it on the site.
  Everyone's favorite dishes are in the **Birthday Favorites** collection (drafts until you write
  them).
- **The advent calendar** shows up on November 20: 24 doors, one to open each day from December 1.
  Behind a door is your post for that day if you've written one (date it that day and give it the
  tag `advent`), or something to do together ("Bake a batch of cookies and share half").
- **Write to Grammi.** A postcard on the front page opens the family's email with a note to you
  already addressed. Fill in **Your email address** on it (Landing page → Write to Grammi); it stays
  hidden until you do. Put your favorite notes on **The Family Wall** page, the fridge: each note
  is a quote (the **"** button in the editor), with who it's from on the last line.
- **Quizzes.** "How well do you know Grammi's kitchen?" is a draft with three questions to fill
  in. **Add knowledge check** in the editor makes more. Answers stay on the reader's own device.
- **Greeting cards.** Open **Greeting cards** (under Family) and add the people you send cards to:
  a name, an email address, and a birthday. **Write a card**, pick who it's for and which card
  (Birthday, Christmas, Thanksgiving, Easter, Valentine, Anniversary, Congratulations, Thinking of you,
  Just because), write your message (`{name}` becomes their first name, `{age}` how old they're turning)
  and pick the day. A birthday card for someone with a birthday on file fills in the day and goes out
  every year. **See the card** shows it as it will arrive; **Send me a test** sends it to you first.
  It goes out at the time you picked, even when your computer is off. The addresses are kept in the
  private database, never on the site.
- **Notes on recipes** (comments) and greeting cards need three free accounts to hold what people
  send and to send the cards (Supabase, Netlify, Brevo). Mikey runs
  `bash scripts/setup-family-service.sh` once; after that every recipe has notes at the bottom, and new
  ones wait for you in **Moderation inbox** until you approve them.

**Making a new look in your own words:** open **Design a theme** and describe it, like
"Warm like my kitchen at Christmas, deep red and pine green, big easy-to-read writing", or tap
one of the ideas. Pick what to **Start from** (Christmas keeps its lights and wreath, Thanksgiving
its leaves). The Assistant makes a theme and you see your own site in it. Say what to change
("a little warmer"), give it a name, and **Save this theme**. Saving doesn't change your site:
put the new theme on from **Seasons**, for the whole site or as its own season. However the
Assistant picks colours, the writing is always made dark or light enough to read easily.

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
  january/ ... october/   one for each month (below)
  christmas-toyshelf/     another Christmas: felt, stitches and old-fashioned toys on the shelf
  family-wall/    the fridge door, for the Family Wall page
  recipe-box/ family-stories/ garden-journal/ baking-day/ letters/ sunday-dinner/
                  looks for recipe collections (below)
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

Each month and collection also has its own stylesheet and lettering, so they don't look like one
page in different colours: a frosted snow-day card in January, a doily in February, a tartan in March,
a gingham picnic in June, an Americana poster in July, a sunburst in August, a chalkboard in
September, a moonlit night in October; a typed index card for the recipe box, a black photo album
for family stories, airmail stationery for letters, blue-willow china for Sunday dinner.

The pictures are drawn in code by `scripts/draw_decorations.py` (Thanksgiving and Christmas) and
`scripts/draw_themes.py` (every other month, and the collection looks), and
`scripts/decorate.py` turns them into tokens. Decorating never means editing `house.css`.
Leaves, snow, petals and the rest of the weather (the `weather` token: `snow`, `hearts`, `clover`,
`petals`, `leaves`, `confetti` or `none`, drawn by `themes/grammis/weather.js`) hold still for anyone whose device asks for less motion,
and recipe pages stay quiet because people are cooking. Phones get the garland, sign and banner, but not the corner piece.

**The house decorates itself.** This is open.blog's `seasons` setting in `openblog.json`
(added in [open.blog#649](https://github.com/journey-to-code-org/open.blog/pull/649)), edited on
Admin's **Seasons** screen:

| Season | Up | Down | What's up | Weather |
| --- | --- | --- | --- | --- |
| January | Jan 7 | Jan 31 | snowflakes, mittens and a snowman; "Warm wishes" | snow |
| February | Feb 1 | Feb 29 | a string of hearts, love letters; "With love" | hearts |
| March | Mar 1 | Mar 31 | shamrocks and gold coins; "Lucky" | clovers |
| April | Apr 1 | Apr 30 | Easter eggs and tulips; "Happy Easter" | petals |
| May | May 1 | May 31 | daisies, tulips and potted flowers for Mother's Day; "In bloom" | petals |
| June | Jun 1 | Jun 30 | strawberries, jam jars and a berry pie; "Berry sweet" | |
| July | Jul 1 | Jul 31 | stars and a flag-bunting fan; "Happy 4th" | confetti |
| August | Aug 1 | Aug 31 | sunflowers and peaches; "Sunny days" | |
| September | Sep 1 | Sep 30 | apples, a bushel bowl and an apple pie; "Apple days" | leaves |
| October | Oct 1 | Oct 31 | a friendly pumpkin patch: jack-o'-lanterns, bats, candy corn; "Happy Halloween" | leaves |
| Thanksgiving | Nov 1 | Nov 30 | (above) | leaves |
| Christmas | Dec 1 | Jan 6 | (above) | snow |

Christmas comes first in the list because it runs over New Year: the first window that holds
today wins, so it keeps the house until January 7. Switch the calendar off and the site wears
`theme` all year (the plain `grammis` house, or any of these).

Every build checks today's date, and the site rebuilds every hour, so a new season shows up within an hour
of its start date. `openblog serve` redecorates by itself at midnight. Days are UTC, so the switch happens
around 7 or 8 pm the evening before on the East Coast.

**Each holiday keeps its own decorations.** Every recipe belongs to a holiday collection
(`content/series/thanksgiving.md`, `christmas.md`), and each collection names its theme. So in
December, the Thanksgiving recipes still have their autumn look while the rest of the house is up for Christmas.

**Looks for collections.** Six themes are made for collections that aren't a holiday. They hang a
ribbon under the header, a shelf along the footer and a pattern behind the page (no bunting or
corner piece: those only go on the home page's welcome card):

| Theme | Ribbon | Shelf |
| --- | --- | --- |
| `recipe-box` | red gingham with jam jars | jars, rolling pin, mixing bowl, pie |
| `family-stories` | old photographs pinned on a string | photos, a teacup, a letter |
| `garden-journal` | a vine of herbs and daisies with little pots | potted herbs |
| `baking-day` | a bakery awning with cupcakes | cupcakes and a birthday cake |
| `letters` | airmail stripes with envelopes | letters, a teacup, a photo |
| `sunday-dinner` | blue-and-white lace with teacups | blue-willow china, pie, cake |

### Adding a season (a birthday, a reunion, ...)

1. Describe it in `scripts/draw_themes.py`: colours for light and dark (they're nudged until
   they're easy to read), the motifs on its garland, the bunting's words, the corner cluster,
   the shelf and the pattern, and its weather. The motifs are in `scripts/decor_library.py`
   (hearts, eggs, apples, teacups, ...). Then run `python3 scripts/draw_themes.py <season>` and
   `python3 scripts/decorate.py <season>`. (Or copy a theme folder and draw `decor/` by hand:
   any of the five pieces; leave one out and it isn't hung.)
2. Add it on the **Seasons** screen (or as a window under `seasons` in `openblog.json`).
3. Add `content/series/<season>.md` with `theme: <season>` for that holiday's recipes.
4. The countdown sign knows New Year's, Valentine's, St. Patrick's, Easter, Mother's and
   Father's Day, the Fourth of July, Labor Day, Halloween, Thanksgiving and Christmas. For another, teach `themes/grammis/components/holiday-countdown.zb` its date and add it to the sign's **Which holiday** choices in `theme.json` (see below).

## Components (Zubra)

`components/` holds web components written in [Zubra](https://github.com/journey-to-code-org/zubra).
They are compiled to plain custom elements (no runtime, nothing to install) into the `grammis`
theme, which declares each one under `components` in its `theme.json`
([open.blog#651](https://github.com/journey-to-code-org/open.blog/pull/651)). Every season extends
`grammis`, so every season offers them.

**Grammi places them herself.** On **Landing page → Add a section**, the theme's components are
listed after the built-in sections ("Countdown sign: a little hanging sign that counts the days until
a holiday"). The form comes from the settings the theme declares (for the sign, **Which holiday**:
whichever comes next, or one of eleven holidays). She can move, hide or delete it like any other section. The preview
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

## The Assistant (for Design a theme)

`openblog.json` already sets the provider (`knowledgeChecks`: Anthropic, `claude-sonnet-5-5`). The
key is never stored in the repository: set it where the editor runs.

```sh
export ANTHROPIC_API_KEY="..."     # or another provider; see open.blog's Admin guide, Optional question generation
openblog serve --admin
```

Grammi's description, the site's title and the name of the theme she starts from are sent to the
provider, and nothing else from the site. Without a key, **Design a theme** says the Assistant isn't
set up, and everything else works as before.

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
