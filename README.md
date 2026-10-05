# budget_widget

An iPhone widget that shows how much money is left and how much you can spend **today**, filled in automatically from bank SMS. A website handles everything else: adding funds, fixing missed payments, fixed bills and analytics.

Working name: **left.** · Stage: brainstorm and design, no app code yet.

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

## What's in this repo

| path | what |
| --- | --- |
| [`docs/brainstorm.md`](docs/brainstorm.md) | the plan: the four numbers, SMS capture with Shortcuts, the website, the widget, design direction, risks, next step |
| [`design/`](design/) | the design board: system sheet, widgets, system map, web console, setup guide, quick-add keypad, plus tokens |

## Next step

A v0 for one person: the capture shortcut, two server endpoints (capture and widget), a Scriptable widget, and an import of the existing `payments.txt` history.
