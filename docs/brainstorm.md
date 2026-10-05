# Brainstorm

*First pass · 4 Oct 2026 · working name **left.***

**The brief:** an iPhone widget that shows how much money is left and what is spendable right now. An iOS Shortcut detects payment SMS and logs them to a CSV that syncs to a website. The website is where you add funds, add missing payments and get analytics, and it should make setup very easy. Design in the spirit of Teenage Engineering.

## 1. One number, built from four

| | number | meaning |
| --- | --- | --- |
| | **BAL** | money in your accounts, anchored to the bank's own balance |
| − | **FIXED** | already promised before payday: rent, EMI, SIP, bills |
| = | **FREE** | yours to plan until payday |
| → | **TODAY** | today's share (FREE at the start of the day ÷ days left) minus what you've spent today |

The widget answers one question: *can I afford this right now?*

Sample numbers: BAL ₹41,280 − FIXED ₹22,500 = FREE ₹18,780. FREE was ₹19,120 at midnight; ÷ 24 days left = ₹796 for today. ₹340 spent so far, so TODAY is ₹456.

- **Payday to payday, not calendar months.** Spend less today and tomorrow's share grows by itself. Overspend and the hit is spread thinly over the days left: go ₹120 over and tomorrow's share drops from ₹796 to ₹791. This replaces the rollover logic in the current `payments.txt` log.

## 2. Capture on the iPhone

- **The CSV is a local journal, not the sync method.** The shortcut appends a line to `tape.csv`, then sends the SMS to the server. The server ignores anything it has already seen (UPI reference + amount + time), so a nightly re-send of the whole file is always safe. iOS 27's new Store Content and Get Stored Content actions let the shortcut remember what it has already sent.
- **Parse on the server, not in Shortcuts.** Bank SMS formats change, and fixing one parser beats reinstalling shortcuts. Optional privacy mode: since iOS 26 the Use Model action can return a Dictionary from the on-device model (iPhone 15 Pro or newer), so parsing could stay on the phone.
- **iOS 27 makes setup one link and one toggle.** Automation triggers now sit at the top of a shortcut, so a shortcut can be shared together with its automations, and several triggers can be stacked in one shortcut. A shared automation arrives switched off on the recipient's phone.
- **Bank app notifications too.** iOS 27's notification trigger can filter by title, subtitle or message, so UPI and bank app alerts can be captured alongside SMS.
- **iOS 26 fallback.** Banks can't be saved as contacts, so the trigger filters on words in the message instead: one automation each for `debited`, `credited`, `spent` and `sent rs`.
- **Drop promotions.** TRAI requires a suffix on commercial SMS sender headers: `-P` promotional, `-S` service, `-T` transactional, `-G` government. Anything ending in `-P` can be ignored.

## 3. The website (console)

Six sections: `/today`, `/tape`, `/funds`, `/fixed`, `/stats`, `/setup`.

Rules most trackers get wrong:

- A credit-card purchase counts once. Paying the card bill later is a transfer, not new spending.
- Moving money between your own accounts isn't spending.
- An ATM withdrawal moves money into a cash wallet; cash spends go in through quick add.
- When one payment triggers two SMS, merge them using the UPI reference.

Two more behaviours:

- **"Add missing payments" becomes a balance check.** When an SMS includes the available balance, compare it with what the tape says. Any difference shows up as "₹1,050 unaccounted since 2 Oct" with three choices: add it, mark it as cash, or ignore.
- **Paying a fixed bill doesn't move TODAY.** Rent leaves BAL and FIXED together, so FREE stays the same.

## 4. The widget

- **v1: Scriptable.** The widget fetches the numbers with a read-only key and caches them. iOS limits how often widgets refresh, so every widget shows when it last synced. A small loader script pulls the latest widget code from the server, so updates never need a reinstall.
- **Configurable means the server sends the layout too.** Pick a variant for each widget size on the website; nothing to reinstall.
- **v2: native app.** The automation hands each SMS straight to the app, so the widget updates the moment a payment arrives, and an interactive "+ cash" button becomes possible.
- **Sizes** (see [`design/Widgets.dc.html`](../design/Widgets.dc.html)): small shows TODAY and a meter; medium adds the four numbers and the cycle strip, or a tape variant; large shows everything around one hero number; lock screen has circular, rectangular and inline versions.

## 5. Design: Teenage Engineering, translated rather than copied

**What their site actually does.** A custom cut of Univers used only in light and thin weights; no rounded corners, shadows or gradients; color rationed down to a single element. The "monospace and orange everywhere" look seen online is a remix; their orange mostly lives on the hardware.

**What carried over.**

- OP-1: a green element on screen means the green encoder controls it. Here, each of the four numbers keeps one color everywhere.
- EP-133: the 12 pads double as a number pad. That became the quick-add keypad.
- Their manuals became the setup field guide.
- Orange appears only for TODAY and for things that need attention.
- Every screen says when it last heard from the bank: show the machine.
- A Telugu line in the console footer, echoing the Japanese text in theirs.

**What didn't.** Their type is their own (a custom Univers cut on the site, and they hold a US design patent on a type font), so the board uses Archivo and DM Mono. Their hairline grey text fails contrast at small sizes, so thin weights appear only on big numbers.

Tokens and rules: [`design/README.md`](../design/README.md).

## 6. Reality check

- **Capturing bank SMS isn't unique.** iLekka, Xyra and FinArt already do it on iPhone. The edge here is the TODAY number, a widget-first design and the look.
- **Apple Pay launched in India at the end of September 2026**, but only for Axis Bank credit cards on Visa and Mastercard: no RuPay, no UPI. Treat it as a later data source.
- **Other people's money data is a responsibility.** Separate write and read keys, store only the last 4 digits of accounts, delete raw SMS after parsing, never ask for bank logins.

## 7. Next step

A v0 for one person: the capture shortcut, two server endpoints (capture with a write-only key, widget with a read-only key), the Scriptable widget, and an import of the existing `payments.txt` history.

## Sources

- [MacStories: iOS and iPadOS 27 review, automations](https://www.macstories.net/stories/ios-and-ipados-27-review/13/)
- [Finny: 5 money shortcuts iOS 27 makes possible](https://getfinny.app/blog/ios-27-shortcuts-money-automations)
- [Gadget Hacks: iOS 27 Shortcuts new actions](https://apple.gadgethacks.com/news/ios-27-shortcuts-app-new-actions-who-can-use-them/)
- [Apple Support: communication triggers in Shortcuts](https://support.apple.com/en-gu/guide/shortcuts/apdd711f9dff/ios)
- [Apple Developer Forums: automations on bank SMS](https://developer.apple.com/forums/thread/705659)
- [WWDC25: the Use Model action](https://developer.apple.com/videos/play/wwdc2025/260/)
- [Shortcut Actions: Apple Intelligence in Shortcuts](https://www.shortcutactions.com/blog/how-to-use-apple-intelligence-in-your-shortcuts)
- [TRAI regulation of 12 Feb 2025 (header suffixes)](https://trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf)
- [GitHub: scriptable-app topic (incl. Scriptable-Auto-Update)](https://github.com/topics/scriptable-app)
- [teenage.engineering](https://teenage.engineering)
- [typ.io: Univers on teenage.engineering](https://typ.io/s/4ozt)
- [Fudge: teenage.engineering fonts, colors and UI patterns](https://design.withfudge.com/share/teenage.engineering-design)
- [Refero: teenage engineering style](https://styles.refero.design/style/aecf9dda-5cba-4dc7-9e73-59b65d895cdf)
- [US design patent D740355: type font, Teenage Engineering AB](https://www.freepatentsonline.com/D740355.html)
- [OP-1 guide: layout](https://teenage.engineering/guides/op-1/original/layout)
- [EP-133 guide: buttons and combos](https://teenage.engineering/guides/ep-133/buttons-and-combos)
- [iLekka on the App Store](https://apps.apple.com/in/app/ilekka-expense-tracker/id6766097186)
- [Xyra](https://xyratrack.in/)
- [FinArt](https://finart.app/)
- [Apple Newsroom: Apple Pay launches in India](https://www.apple.com/in/newsroom/2026/09/apple-pay-launches-in-india/)
- [TechCrunch: Apple Pay launches in India](https://techcrunch.com/2026/09/29/apple-pay-set-to-launch-in-india-with-axis-bank-today-sources-say/)
- [MediaNama: Apple Pay without UPI](https://www.medianama.com/2026/08/223-apple-pay-launch-india-without-upi/)
