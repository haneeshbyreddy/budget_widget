# budget_widget

An iPhone widget that shows how much money is left and how much you can spend **today**, filled in automatically from bank SMS. A website handles everything else: adding funds, fixing missed payments, fixed bills and analytics.

Working name: **left.** · Stage: iPhone-only v0 script, not yet tried on a real phone.

## The idea

```
BAL − FIXED = FREE
today's share = FREE at the start of the day ÷ days left until payday
TODAY = today's share − spent today
```

The widget answers one question before you pay: *can I afford this today?* Cycles run payday to payday, not by calendar month.

## How it works

1. A bank SMS arrives.
2. The capture shortcut appends it to `tape.csv` on iCloud Drive and sends it to the server.
3. The server parses it, drops duplicates and recomputes the four numbers.
4. The widget reads those numbers with a read-only key.
5. The website is where you add funds, fill gaps, manage fixed bills and see stats.

Every night the shortcut re-sends `tape.csv`; anything the server has already seen is ignored.

The v0 skips the server: one Scriptable script reads each SMS on the phone, writes `tape.csv` and draws the widget.

## What's in this repo

| path | what |
| --- | --- |
| [`docs/brainstorm.md`](docs/brainstorm.md) | the plan: the four numbers, SMS capture with Shortcuts, the website, the widget, design direction, risks, next step |
| [`design/`](design/) | the design board: system sheet, widgets, system map, web console, setup guide, quick-add keypad, plus tokens |
| [`scriptable/left.js`](scriptable/left.js) | the v0 script for Scriptable on iPhone: reads bank SMS from a Shortcuts automation, keeps `tape.csv` in iCloud Drive, draws the home and lock screen widgets, and runs setup and fixes in the app |

## Next step

Try `left.js` on a real iPhone, then import the existing `payments.txt` history. The server and website come after.
