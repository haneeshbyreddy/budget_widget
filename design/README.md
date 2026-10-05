# design

The design board for **left.**, made on a Claude Design canvas. [Open the live board](https://claude.ai/artifact/DafTz3DEmJgw7PyjzpA5AH) (private to its owner until shared).

All money figures, names, accounts and keys on the board are sample data.

| file | artboard | size (px) |
| --- | --- | --- |
| `Main.dc.html` | 00 · system sheet: the four numbers, color, type, parts, rules | 1440 × 2000 |
| `Widgets.dc.html` | 01 · widgets: small, medium and large in light and dark, plus lock screen | 2020 × 1440 |
| `Map.dc.html` | 02 · system map: how a bank SMS becomes four numbers | 1440 × 720 |
| `Console.dc.html` | 03 · console: the website's `/today` page, responsive | 1440 × 1400 |
| `Guide.dc.html` | 04 · setup field guide: six-step onboarding on a phone | 390 × 2000 |
| `Quick.dc.html` | 05 · quick add: working keypad for cash spends and funds | 390 × 844 |
| `canvas.json` | board layout: positions, titles, order | — |

Each `.dc.html` file is one self-contained artboard; `canvas.json` places them on the board.

## Tokens

### Color

| role | light (alu) | dark (display) |
| --- | --- | --- |
| paper | `#F2F2EF` | `#0C0C0E` |
| panel | `#FCFCFA` | `#18181B` |
| ink | `#0E0E10` | `#EDEDE8` |
| ink 2 | `#4A4A47` | `#B4B4AE` |
| ink 3 | `#6E6E6A` | `#8A8A85` |
| line | `#D9D9D4` | `#2C2C30` |
| **bal** | `#2B46C8` | `#6B84FF` |
| **fixed** | `#8E8E89` | `#CFCFC8` |
| **free** | `#1E7A47` | `#3FD483` |
| **today** | `#F2541B` | `#FF6A2B` |

### Type

| use | face | notes |
| --- | --- | --- |
| display numbers | Archivo 200, width 112% | 56–136 px; hairline weights only at big sizes |
| headings, body | Archivo 300 / 400 | words in lowercase |
| labels, money | DM Mono 400 | labels in caps; ₹ with lakh commas (1,24,500) |
| widget | SF Pro Thin + SF Mono | both ship with iOS, no font installs |

### Rules

1. One hero number per surface. Everything else whispers.
2. Four channels, four colors: never reassigned, never decoration.
3. Orange is rationed: today and attention only, and never as small text.
4. Square corners and hairlines. No shadows, no gradients, no cards inside cards.
5. Words lowercase, labels caps, money in mono with ₹ and lakh commas.
6. Show the machine: every surface says when it last heard from your bank.
