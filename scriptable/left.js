// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: wallet;

// left. — how much is left, at a glance.
// v0.3 · runs only on your iPhone · github.com/haneeshbyreddy/budget_widget
//
// One script, three jobs:
//   capture  a Shortcuts automation filters money texts with its triggers, Apple's on-device
//            AI reads each one, and left. saves the AI's answer as a row in tape.csv.
//            (Older two-step Shortcuts that hand over the text itself still work too.)
//   widget   home screen + lock screen: TODAY, BAL, FIXED, FREE.
//   app      tap it in Scriptable: setup, cash spends, fixes, balances, bills.
//
// Your data: iCloud Drive › Scriptable › left › tape.csv + settings.json. Nothing leaves your phone.

const VERSION = "0.3.0"

// ─── slots and banks ─────────────────────────────────────────────

const SLOTS = [
  ["FD", "food"], ["TR", "travel"], ["BL", "bills"], ["SH", "shop"],
  ["HM", "home"], ["FN", "fun"], ["HL", "health"], ["OT", "other"],
]

const SLOT_WORDS = {
  FD: ["swiggy", "zomato", "eatsure", "dominos", "domino's", "pizza", "kfc", "mcdonald", "mcdonalds", "burger king", "starbucks", "chaayos", "cafe", "café", "coffee", "restaurant", "bakery", "biryani", "chai", "juice", "dhaba", "sweets", "haldiram", "subway", "barbeque", "food"],
  TR: ["uber", "ola", "rapido", "metro", "irctc", "redbus", "indigo", "akasa", "spicejet", "air india", "makemytrip", "goibibo", "ixigo", "petrol", "diesel", "fuel", "hpcl", "bpcl", "iocl", "indian oil", "fastag", "parking", "toll", "yulu", "namma yatri"],
  BL: ["electricity", "bescom", "tsspdcl", "tgspdcl", "apspdcl", "tata power", "bses", "airtel", "jio", "vodafone", "bsnl", "act fibernet", "hathway", "broadband", "tata play", "recharge", "insurance", "lic", "premium", "water board", "gas"],
  SH: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tatacliq", "croma", "reliance digital", "decathlon", "ikea", "lenskart", "snapdeal", "purplle"],
  HM: ["zepto", "blinkit", "bigbasket", "instamart", "dmart", "d-mart", "jiomart", "grocery", "kirana", "supermarket", "milk", "country delight", "licious", "urban company", "laundry"],
  FN: ["netflix", "spotify", "hotstar", "prime video", "youtube", "bookmyshow", "pvr", "inox", "cinepolis", "steam", "playstation", "sony liv", "zee5", "district"],
  HL: ["apollo", "pharmacy", "pharmeasy", "1mg", "netmeds", "medplus", "hospital", "clinic", "diagnostic", "practo", "cult", "gym", "dental", "medical"],
}

const BANKS = [
  ["state bank", "sbi"], ["sbi", "sbi"], ["hdfc", "hdfc"], ["icici", "icici"], ["axis", "axis"], ["kotak", "kotak"],
  ["idfc", "idfc"], ["indusind", "indusind"], ["yes bank", "yes"], ["punjab national", "pnb"], ["pnb", "pnb"],
  ["bank of baroda", "bob"], ["canara", "canara"], ["union bank of india", "union"], ["union bank", "union"],
  ["bank of india", "boi"], ["indian bank", "indian"], ["indian overseas", "iob"], ["federal", "federal"], ["rbl", "rbl"],
  ["au small", "au"], ["bandhan", "bandhan"], ["idbi", "idbi"], ["uco", "uco"], ["central bank", "central"],
  ["paytm", "paytm"], ["airtel payments", "airtel"], ["jupiter", "jupiter"], ["onecard", "onecard"], ["amex", "amex"],
  ["american express", "amex"], ["citi", "citi"], ["hsbc", "hsbc"], ["standard chartered", "sc"], ["dbs", "dbs"],
  ["equitas", "equitas"], ["ujjivan", "ujjivan"], ["karnataka bank", "kbl"], ["south indian bank", "sib"],
  ["city union", "cub"], ["karur vysya", "kvb"], ["tamilnad mercantile", "tmb"], ["slice", "slice"],
]

const DEFAULTS = { v: 1, payday: 1, accounts: [], bills: [], notify: true, setupAt: null }
const COLS = ["id", "time", "kind", "amount", "what", "slot", "account", "ref", "bal", "bill", "src", "raw", "reader", "alt"]

// ─── small helpers ───────────────────────────────────────────────

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const pad = n => String(n).padStart(2, "0")
const sum = xs => xs.reduce((a, b) => a + b, 0)
const byTime = (a, b) => a.time - b.time
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const wordIn = (hay, w) => new RegExp("(?:^|[^a-z0-9])" + esc(w) + "(?:$|[^a-z0-9])").test(hay)
const isBankId = id => !!id && id !== "cash" && !id.startsWith("card")
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function num(s) {
  if (s === null || s === undefined || s === "") return null
  const v = parseFloat(String(s).replace(/[,₹\s]/g, "").replace(/^(?:rs\.?|inr)/i, ""))
  return isNaN(v) ? null : v
}
function money(s) { return parseFloat(String(s).replace(/,/g, "")) }
function group(n) {
  const s = String(Math.round(Math.abs(n)))
  if (s.length <= 3) return s
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3)
}
function inr(n, plus) {
  const v = Math.round(n)
  return (v < 0 ? "−" : plus && v > 0 ? "+" : "") + "₹" + group(v)
}
function amt(n) { const v = Math.round(n); return (v < 0 ? "−" : "+") + group(v) }
function compact(n) {
  const a = Math.abs(n), s = n < 0 ? "−" : ""
  const one = x => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "")
  if (a < 1000) return s + "₹" + Math.round(a)
  if (a < 100000) return s + "₹" + one(a / 1000) + "K"
  if (a < 10000000) return s + "₹" + one(a / 100000) + "L"
  return s + "₹" + one(a / 10000000) + "Cr"
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function addDays(d, k) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k) }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 864e5) }
function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()) }
function dmon(d) { return pad(d.getDate()) + " " + MON[d.getMonth()] }
function when(d, now) { const k = daysBetween(d, now); return k === 0 ? hm(d) : k === 1 ? "YDA" : dmon(d) }
function iso(d) {
  const o = -d.getTimezoneOffset(), a = Math.abs(o)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${o >= 0 ? "+" : "-"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

// ─── reading a bank SMS ──────────────────────────────────────────

const CUR = "(?<![a-z])(?:rs\\.?|inr|₹)"
const AMT = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)"
const OUT_RE = /\b(?:debited|spent|withdrawn|deducted)\b|\bsent\s*(?:rs|inr|₹)|\bpaid\s*(?:rs|inr|₹)|\bpaid\s+to\b|\bdebit\s+(?:of|for)\b/
const IN_RE = /\b(?:credited|received|deposited|refunded|reversed|reversal)\b|\brefund\b|\bcredit\s+(?:of|for)\b/
const PAST_RE = /\b(?:debited|credited|spent|withdrawn|deducted)\b/
const MASK_RE = /(?:a\/c|acct|account|card)[^0-9]{0,14}[x*•]+\s*\d{3,6}(?!\d)|ending\s*(?:with\s*)?\d{4}(?!\d)/
const CC_ACCT_RE = /credit card\s*(?:a\/c|account|acct)\.?\s*(?:no\.?|number)?\s*[:\-]?\s*[x*•.]*\s*(\d{3,6})(?!\d)/
const ACCT_RE = /(?:a\/c|acct|account)\.?\s*(?:no\.?|number|num)?\s*[:\-]?\s*(?:ending\s*(?:with\s*)?)?[x*•.]*\s*(\d{3,6})(?!\d)/
const CARD_RE = /card\s*(?:no\.?|number)?\s*[:\-]?\s*(?:ending\s*(?:with\s*)?)?[x*•.]*\s*(\d{4})(?!\d)/
const BANK_MASK_RE = /bank\s+[x*•]+\s*(\d{3,6})(?!\d)/
const BAL_RE = /(?<![a-z])bal(?:ance)?\b[^0-9a-z]{0,6}(?:is|of)?[^0-9a-z]{0,4}(?:rs\.?|inr|₹)\s*(-?[0-9][0-9,]*(?:\.[0-9]{1,2})?)/
const REF_RE = /(?:upi\s*(?:ref(?:erence)?)?(?:\s*no\.?)?|ref(?:erence)?\s*(?:no\.?|number|id)?|refno|utr(?:\s*no\.?)?|rrn|txn\s*(?:id|no\.?))\s*[:.#\-]?\s*([a-z]{0,6}[0-9]{6,}[a-z0-9]*)/
const ATM_RE = /\batm\b|cash withdrawal|\bwdl\b|withdrawn/
const CARDBILL_RE = /credit card (?:bill|payment|dues?)|card (?:bill|payment|dues)\b|\bcc\s*(?:bill|payment|pymt)|towards (?:your )?(?:\w+ )?(?:credit )?card|\bcred\b|bill ?desk.{0,20}card/
const PROMO_RE = /\b(?:eligible|pre-?approved|offer|apply|loan of|upgrade|congratulations|reward points|voucher|win)\b|limit (?:increase|enhance)/
const AUTOPAY_RE = /\b(?:e-?)?mandate\b|\bauto-?pay\b|\bauto[\s-]?debit\b|\bn?ach\b|standing instruction/

function ignoreWhy(t) {
  if (/\b(?:will|to|shall)\s+be\s+(?:debited|credited|deducted|charged|paid|reversed|refunded)\b/.test(t)) return "a payment that hasn't happened yet"
  // autopay (UPI mandate) notices: the reminder before a debit, and set-up / cancel messages
  const done = PAST_RE.test(t) || /\bsent\s*(?:rs|inr|₹)/.test(t)
  if (!done && /\b(?:upcoming|scheduled|pre-?debit|pre-?notification)\b/.test(t)) return "a payment that hasn't happened yet"
  if (!done && /\bmandate\b/.test(t) && /\b(?:created|registered|set ?up|approved|authori[sz]ed|revoked|cancell?ed|paused|resumed|modified|updated|declined|expired)\b/.test(t)) return "an autopay update, not a payment"
  if (/\botp\b|one[\s-]?time password|verification code/.test(t) && !PAST_RE.test(t)) return "a one-time password"
  if ((/\b(?:failed|declined|unsuccessful|insufficient)\b|not successful|could not be processed/.test(t)) && !/\b(?:reversed|refunded|refund|credited)\b/.test(t)) return "a failed payment"
  if (/\bhas requested\b|\brequested you\b|collect request|payment request|\brequesting\b/.test(t)) return "a payment request, not a payment"
  if (/\b(?:due date|is due|due on|due by|amount due|amt due|min(?:imum)? (?:amt|amount)|statement (?:for|of|is|generated)|bill (?:is )?generated)\b/.test(t) && !PAST_RE.test(t)) return "a bill reminder"
  return null
}

function bankOf(t) {
  let best = null
  for (const [k, v] of BANKS) if (new RegExp("\\b" + esc(k)).test(t) && (!best || k.length > best[0].length)) best = [k, v]
  return best ? best[1] : null
}

function amountsIn(t) {
  const re = new RegExp(CUR + "\\s*" + AMT, "g")
  const out = []
  let m
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 28), m.index)
    if (/(?:bal|balance|limit|lmt|outstanding|o\/s|due|avl|avail|available)[^a-z0-9]*(?:is|of|amt|amount)?[^a-z0-9]*$/.test(before)) continue
    const v = money(m[1])
    if (v > 0) out.push(v)
  }
  return out
}

function cleanName(s) {
  let c = String(s || "").toLowerCase().trim().replace(/^vpa\s+/, "")
  if (c.includes("@")) c = c.split("@")[0].replace(/[._\-]+/g, " ")
  c = c.replace(/[^a-z0-9 &']/g, " ").replace(/\s+/g, " ").trim()
  if (!c || c.length < 2 || /^\d+$/.test(c) || /^(?:rs|inr)\s*\d/.test(c)) return ""
  if (/^(?:imps|neft|rtgs|upi|ach|nach|ecs|mmt)$/.test(c)) return ""
  if (/^(?:your|you|ur|the|self|mobile|beneficiary|a c|ac|acct|account|bank|card|date)\b/.test(c)) return ""
  if (/\b(?:a c|acct|account|bank)\b/.test(c)) return ""
  return c.length > 24 ? c.slice(0, 25).replace(/\s+\S*$/, "").slice(0, 24).trim() : c
}

function merchantOf(t, dir) {
  // a name ends at a joining word, at punctuation, or where a date starts ("To AXIO 05/10/26")
  const stop = "(?=\\s+(?:on|via|ref|refno|upi|txn|from|for|dated|date|not|avl|avail|info|at|in|using|with|is|has|and|thru|through)\\b|\\s+\\d{1,2}[-\\/.](?:\\d{1,2}|[a-z]{3})|[.,;:(]|$)"
  const name = "([a-z][a-z0-9 .&'@_\\-]{1,40}?)"
  const info = () => {
    const m = t.match(/info[:\s-]+([a-z0-9 \/\-_.@*]{2,60})/)
    if (!m) return ""
    const parts = m[1].split(/\.\s/)[0].split(/[\/*\-]/).map(x => x.trim())
      .filter(x => /[a-z]{2,}/.test(x) && !/^(?:upi|neft|imps|rtgs|p2a|p2m|ach|nach|ecs|mmt|ib|mb|bil|onl|inb)$/.test(x))
    return parts.length ? cleanName(parts[parts.length - 1]) : ""
  }
  const vpa = /vpa\s+([a-z0-9][a-z0-9.\-_]*@[a-z]+)/
  const at = new RegExp("\\bat\\s+" + name + stop)
  const tries = dir < 0 ? [
    /upi\/p2[am]\/[0-9]+\/([^\/]+?)(?:\/|\s|$)/,
    /;\s*([a-z][a-z0-9 .&'@_\-]{1,40}?)\s+credited/,
    at,
    new RegExp("\\bto\\s+(?:vpa\\s+)?" + name + stop),
    vpa,
    /\bist\s+([a-z][a-z0-9 .&'@_\-]{1,30}?)\s+(?:avl|available)/,
    info,
    new RegExp("\\bon\\s+(?!date|your|\\d)" + name + "(?=[.;,]|\\s+(?:avl|available|ref|upi|txn)\\b|$)"),
  ] : [
    vpa,
    new RegExp("\\bfrom\\s+(?:vpa\\s+)?" + name + stop),
    new RegExp("\\bby\\s+(?:vpa\\s+)?" + name + stop),
    /upi\/p2[ap]\/[0-9]+\/([^\/]+?)(?:\/|\s|$)/,
    info,
    at,
  ]
  for (const re of tries) {
    if (typeof re === "function") { const c = re(); if (c) return c; continue }
    const m = t.match(re)
    if (m) { const c = cleanName(m[1]); if (c) return c }
  }
  return ""
}

function dateIn(t, now) {
  let m, y, mo, d
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
  if ((m = t.match(/\b(20\d\d)-(\d\d)-(\d\d)/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3] }
  else if ((m = t.match(/\b(\d{1,2})[-\/. ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\/. ,]*(\d{2,4})\b/))) { d = +m[1]; mo = months.indexOf(m[2]); y = +m[3] }
  else if ((m = t.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/))) { d = +m[1]; mo = +m[2] - 1; y = +m[3] }
  else return null
  if (y < 100) y += 2000
  const dt = new Date(y, mo, d)
  if (isNaN(dt) || dt.getMonth() !== mo || dt > addDays(now, 1) || dt < addDays(now, -400)) return null
  return dt
}

// account numbers named anywhere in the SMS (used to spot money moving between your own accounts)
function mentionedIn(t) {
  const out = [], all = new RegExp(ACCT_RE.source, "g")
  let m
  while ((m = all.exec(t))) out.push(m[1].slice(-4))
  return out
}

function parseSms(input, now) {
  now = now || new Date()
  const raw = String(input === null || input === undefined ? "" : input).replace(/\s+/g, " ").trim()
  const t = raw.toLowerCase()
  const no = why => ({ ok: false, why, raw })
  if (!raw) return no("empty")
  const skip = ignoreWhy(t)
  if (skip) return no(skip)
  const bank = bankOf(t)
  const bankish = MASK_RE.test(t) || (!!bank && /(?:a\/c|\bacct\b|\baccount\b|\bcard\b|\bupi\b)/.test(t))
  if (!bankish) return no("not a bank message")
  const mo = t.match(OUT_RE), mi = t.match(IN_RE)
  const iOut = mo ? mo.index : -1, iIn = mi ? mi.index : -1
  if (iOut < 0 && iIn < 0) {
    if (PROMO_RE.test(t)) return no("an offer or ad")
    if (/\b(?:txn|transaction|payment|transfer|upi|neft|imps|rtgs)\b/.test(t) && amountsIn(t).length) return no("review")
    return no("not a payment")
  }
  const dir = iOut >= 0 && (iIn < 0 || iOut < iIn) ? -1 : 1
  let amount = amountsIn(t)[0]
  if (!amount) {
    const m = t.match(/(?:debited|credited|spent|withdrawn|deducted)\s+(?:by|for|with|of)?\s*(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/)
    if (m) amount = money(m[1])
  }
  if (!amount || amount <= 0 || amount > 1e8) return no("review")

  let type = "bank", account = null, m
  if ((m = t.match(CC_ACCT_RE))) { type = "card"; account = "card" + m[1].slice(-4) }
  else if ((m = t.match(ACCT_RE)) || (m = t.match(BANK_MASK_RE))) { account = m[1].slice(-4) }
  else if ((m = t.match(CARD_RE)) && !/debit card/.test(t)) { type = "card"; account = "card" + m[1] }

  const bm = t.match(BAL_RE)
  const rm = t.match(REF_RE) || t.match(/upi\/p2[amp]\/(\d{6,})/)
  return {
    ok: true, raw, dir, amount, type, account, bank, mentioned: mentionedIn(t),
    bal: bm ? money(bm[1]) : null,
    ref: rm ? rm[1] : "",
    what: merchantOf(t, dir),
    atm: ATM_RE.test(t),
    cardBill: CARDBILL_RE.test(t),
    refund: /\brefund(?:ed)?\b|\breversed\b|\breversal\b|cashback/.test(t),
    salary: /\bsalary\b|\bsal\b|payroll/.test(t),
    autopay: AUTOPAY_RE.test(t),
    date: dateIn(t, now),
  }
}

// ─── tape.csv ────────────────────────────────────────────────────

function csvCell(v) {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function toCsv(rows) {
  return [COLS.join(",")].concat(rows.map(r => COLS.map(c => csvCell(c === "time" ? iso(r.time) : r[c])).join(","))).join("\n") + "\n"
}
function parseCsv(text) {
  const out = []
  let row = [], cell = "", q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ",") { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cell); out.push(row); row = []; cell = ""
    } else cell += ch
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row) }
  return out
}
function fromCsv(text) {
  const t = parseCsv(text || "")
  if (!t.length) return []
  const head = t[0]
  return t.slice(1).filter(r => r.length > 1).map(r => {
    const g = c => { const i = head.indexOf(c); return i >= 0 && i < r.length ? r[i] : "" }
    return {
      id: g("id") || newId(), time: new Date(g("time")), kind: g("kind"), amount: num(g("amount")) || 0,
      what: g("what"), slot: g("slot"), account: g("account"), ref: g("ref"), bal: num(g("bal")),
      bill: g("bill"), src: g("src"), raw: g("raw"), reader: g("reader"), alt: g("alt"),
    }
  }).filter(r => !isNaN(r.time))
}

// ─── accounts and balances ───────────────────────────────────────

function sameBank(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (/^\d+$/.test(a) && /^\d+$/.test(b) && Math.min(a.length, b.length) >= 3) return a.endsWith(b) || b.endsWith(a)
  return false
}
function belongs(r, id) {
  if (id === "card") return (r.account || "").startsWith("card")
  if (id === "cash") return r.account === "cash"
  return sameBank(id, r.account)
}
function isAnchor(r, id) { return belongs(r, id) && r.bal !== null && r.bal !== undefined && !["ignore", "review"].includes(r.kind) }
function delta(r, id) {
  if (["anchor", "ignore", "review"].includes(r.kind)) return 0
  if (id === "cash" && r.kind === "atm") return Math.abs(r.amount)
  return belongs(r, id) ? r.amount : 0
}
function balanceAt(rows, id, t) {
  const list = rows.filter(r => belongs(r, id) || (id === "cash" && r.kind === "atm")).sort(byTime)
  let a = -1
  list.forEach((r, i) => { if (r.time <= t && isAnchor(r, id)) a = i })
  if (a >= 0) {
    let b = list[a].bal
    for (let j = a + 1; j < list.length; j++) if (list[j].time <= t) b += delta(list[j], id)
    return b
  }
  const k = list.findIndex(r => r.time > t && isAnchor(r, id))
  if (k >= 0) {
    let b = list[k].bal
    for (let j = 0; j <= k; j++) if (list[j].time > t) b -= delta(list[j], id)
    return b
  }
  return sum(list.filter(r => r.time <= t).map(r => delta(r, id)))
}
function bankIds(rows, settings) {
  const ids = (settings.accounts || []).map(a => a.id)
  for (const r of rows) {
    if (!isBankId(r.account) || ["ignore", "review"].includes(r.kind)) continue
    if (!ids.some(id => sameBank(id, r.account))) ids.push(r.account)
  }
  return ids
}
function acctLabel(id, s) {
  if (!id) return "—"
  if (id === "cash") return "cash"
  if (id.startsWith("card")) return id.length > 4 ? "card ··" + id.slice(4) : "credit cards"
  if (!/^\d+$/.test(id)) return "bank"
  const a = (s.accounts || []).find(x => sameBank(x.id, id))
  return `${a ? a.name : "bank"} ··${id}`
}
function anchorRow(account, bal, time, src) {
  return { id: newId(), time, kind: "anchor", amount: 0, what: "balance set", slot: "", account, ref: "", bal, bill: "", src, raw: "" }
}

// ─── the cycle and the four numbers ──────────────────────────────

function cycleFor(now, payday) {
  const P = Math.max(1, Math.min(31, parseInt(payday, 10) || 1))
  const dim = (y, m) => new Date(y, m + 1, 0).getDate()
  const pd = (y, m) => new Date(y, m, Math.min(P, dim(y, m)))
  const today = startOfDay(now)
  let start = pd(today.getFullYear(), today.getMonth())
  if (start > today) start = pd(today.getFullYear(), today.getMonth() - 1)
  const next = pd(start.getFullYear(), start.getMonth() + 1)
  return { start, next, today, length: daysBetween(start, next), dayNo: daysBetween(start, today) + 1, daysLeft: daysBetween(today, next) }
}
function dueIn(bill, cyc) {
  const dim = (y, m) => new Date(y, m + 1, 0).getDate()
  const at = (y, m) => new Date(y, m, Math.min(bill.day, dim(y, m)))
  let d = at(cyc.start.getFullYear(), cyc.start.getMonth())
  if (d < cyc.start) d = at(cyc.start.getFullYear(), cyc.start.getMonth() + 1)
  return d
}

function compute(rows, settings, now) {
  now = now || new Date()
  const cyc = cycleFor(now, settings.payday)
  const live = rows.filter(r => r.time <= now)
  const banks = bankIds(live, settings).map(id => ({
    id, label: acctLabel(id, settings), bal: balanceAt(live, id, now),
    anchored: live.some(r => isAnchor(r, id)),
  }))
  const cash = balanceAt(live, "cash", now)
  const cardDue = Math.max(0, -balanceAt(live, "card", now))
  const bills = (settings.bills || []).map(b => {
    const due = dueIn(b, cyc)
    const pay = live.filter(r => r.kind === "fixed" && r.bill === b.name && r.time >= cyc.start).sort(byTime)
    const paid = pay.length > 0
    return { name: b.name, amount: b.amount, day: b.day, due, paid, paidAt: paid ? pay[pay.length - 1].time : null, overdue: !paid && due < cyc.today }
  })
  const billsLeft = sum(bills.filter(b => !b.paid).map(b => b.amount))
  const bal = sum(banks.map(b => b.bal)) + cash
  const fixed = billsLeft + cardDue
  const free = bal - fixed
  const dayRows = d => live.filter(r => r.time >= d && r.time < addDays(d, 1))
  const spentOn = d => {
    const rs = dayRows(d)
    return sum(rs.filter(r => r.kind === "spend").map(r => -r.amount)) - sum(rs.filter(r => r.kind === "refund").map(r => r.amount))
  }
  const spent = spentOn(cyc.today)
  const share = Math.floor((free + spent) / cyc.daysLeft)
  const today = share - spent
  const days = []
  for (let k = 6; k >= 0; k--) { const d = addDays(cyc.today, -k); days.push({ d, spent: spentOn(d) }) }
  const tape = live.filter(r => !["anchor", "ignore"].includes(r.kind)).sort((a, b) => b.time - a.time)
  const sms = live.filter(r => r.src === "sms").sort((a, b) => b.time - a.time)
  const warnings = []
  banks.filter(b => !b.anchored).forEach(b => warnings.push({ type: "balance", id: b.id, text: `${b.label}: no balance yet — tap to set it` }))
  bills.filter(b => b.overdue).forEach(b => warnings.push({ type: "bill", name: b.name, text: `${b.name} (due ${dmon(b.due).toLowerCase()}) not seen yet — paid?` }))
  const reviews = live.filter(r => r.kind === "review" && r.time >= addDays(now, -30))
  if (reviews.length) warnings.push({ type: "review", text: `${reviews.length} bank SMS ${reviews.length === 1 ? "needs" : "need"} a look` })
  return {
    now, cyc, banks, cash, cardDue, bills, billsLeft, bal, fixed, free, spent, share, today,
    entries: dayRows(cyc.today).filter(r => r.kind === "spend").length,
    days, tape, lastSms: sms.length ? sms[0].time : null, warnings,
  }
}

// ─── turning a parsed SMS into a row ─────────────────────────────

function slotFor(what) {
  const hay = String(what || "").toLowerCase()
  let best = null
  for (const slot of Object.keys(SLOT_WORDS)) for (const w of SLOT_WORDS[slot]) {
    if (wordIn(hay, w) && (!best || w.length > best[1].length)) best = [slot, w]
  }
  return best ? best[0] : "OT"
}

function matchBill(p, db, time) {
  const s = db.settings
  if (!s.bills || !s.bills.length) return null
  const cyc = cycleFor(time, s.payday)
  const paid = name => db.rows.some(r => r.kind === "fixed" && r.bill === name && r.time >= cyc.start)
  const raw = (p.raw + " " + (p.what || "")).toLowerCase()
  // a bill is spotted by a word from its SMS (any day), or by its exact amount within a week of its due date
  const near = b => Math.abs(daysBetween(dueIn(b, cyc), time)) <= 7
  const cands = s.bills.filter(b => !paid(b.name) && ((b.match && raw.includes(String(b.match).toLowerCase())) || (Math.abs(b.amount - p.amount) <= 1 && near(b))))
  if (!cands.length) return null
  cands.sort((a, b) => Math.abs(dueIn(a, cyc) - time) - Math.abs(dueIn(b, cyc) - time))
  return cands[0]
}

function buildRow(p, db, now, src) {
  const s = db.settings
  const time = src === "paste" && p.date && daysBetween(p.date, now) > 0
    ? new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate(), 12) : now
  let account = p.account
  if (!account) account = (s.accounts[0] && s.accounts[0].id) || "bank"
  else if (p.type === "bank") { const known = s.accounts.find(a => sameBank(a.id, account)); if (known) account = known.id }
  const useBal = p.type === "bank" && (p.account || s.accounts.length <= 1)
  const row = { id: newId(), time, kind: "", amount: p.dir * p.amount, what: p.what, slot: "", account, ref: p.ref || "", bal: useBal ? p.bal : null, bill: "", src, raw: p.raw }
  if (p.dir < 0) {
    if (p.type === "bank" && p.atm) { row.kind = "atm"; row.what = "atm cash" }
    else if (p.type === "bank" && p.cardBill) { row.kind = "cardbill"; row.what = row.what || "card bill" }
    else {
      const bill = matchBill(p, db, time)
      if (bill) { row.kind = "fixed"; row.bill = bill.name; row.slot = "BL"; row.what = row.what || bill.name }
      else { row.kind = "spend"; row.slot = p.autopay ? "BL" : slotFor(p.what) }
    }
  } else {
    if (p.type === "card") row.kind = p.refund ? "refund" : "cardpay"
    else row.kind = p.refund ? "refund" : "income"
    if (p.salary) row.what = "salary"
  }
  // the SMS names another of your own accounts → money moving between them, not spending
  const own = (s.accounts || []).map(a => a.id)
  if (["spend", "income", "fixed"].includes(row.kind) && isBankId(row.account) &&
      (p.mentioned || []).some(a => !sameBank(a, row.account) && own.some(o => sameBank(o, a)))) {
    Object.assign(row, { kind: "transfer", slot: "", bill: "", what: "between my accounts" })
  }
  if (!row.what) row.what = p.dir < 0 ? "payment" : "money in"
  return row
}

function label(r) { return r.kind === "fixed" && r.bill ? r.bill : r.what }

function reviewRow(p, now) {
  return { id: newId(), time: now, kind: "review", amount: 0, what: "needs a look", slot: "", account: p.account || "", ref: "", bal: null, bill: "", src: "sms", raw: p.raw }
}

function isDup(row, rows) {
  return rows.some(r => {
    if (r.src === "you" || r.kind === "anchor") return false
    if (Math.sign(r.amount) !== Math.sign(row.amount) || Math.abs(Math.abs(r.amount) - Math.abs(row.amount)) > 0.01) return false
    if (row.ref && r.ref) return r.ref === row.ref
    if (r.raw && r.raw === row.raw && Math.abs(r.time - row.time) < 864e5) return true
    return r.account === row.account && Math.abs(r.time - row.time) <= 3 * 60 * 1000
  })
}

function pairTransfer(rows, row) {
  // money that leaves one of your accounts and lands in another within 30 minutes isn't spending
  const kinds = ["spend", "income", "fixed"]
  if (!kinds.includes(row.kind) || !isBankId(row.account)) return false
  const mate = rows.find(r => r !== row && kinds.includes(r.kind) && r.src !== "you" && isBankId(r.account) && !sameBank(r.account, row.account) &&
    Math.sign(r.amount) === -Math.sign(row.amount) && Math.abs(Math.abs(r.amount) - Math.abs(row.amount)) < 0.01 &&
    Math.abs(r.time - row.time) <= 30 * 60 * 1000)
  if (!mate) return false
  for (const r of [row, mate]) { r.kind = "transfer"; r.slot = ""; r.bill = ""; r.what = "between my accounts" }
  return true
}

function learnAccount(settings, p, row) {
  if (p.type !== "bank" || !p.account || !isBankId(row.account)) return false
  if ((settings.accounts || []).some(a => sameBank(a.id, row.account))) return false
  settings.accounts.push({ id: row.account, name: p.bank || "bank" })
  return true
}

function tag(r) {
  const slotName = (SLOTS.find(s => s[0] === r.slot) || [])[1]
  switch (r.kind) {
    case "spend": return `${r.slot || "OT"} ${slotName || "other"}`
    case "fixed": return "monthly bill"
    case "atm": return "atm → cash"
    case "cardbill": return "card bill"
    case "transfer": return "between my accounts"
    case "income": return "money in"
    case "refund": return "refund"
    case "cardpay": return "card payment received"
    case "review": return "needs a look"
    case "ignore": return "ignored"
    case "anchor": return "balance set"
    default: return r.kind
  }
}

function todayLine(n) { return n.today >= 0 ? `${inr(n.today)} left today` : `${inr(-n.today)} over today` }

function describeCapture(row, n) {
  const free = `${inr(n.free)} free`
  switch (row.kind) {
    case "spend": return { title: `${inr(row.amount)} · ${row.what}`, body: `${todayLine(n)} · ${free}`, notify: true }
    case "fixed": return { title: `${row.bill} paid · ${inr(row.amount)}`, body: `kept aside already, so today stays ${inr(n.today)}`, notify: true }
    case "atm": return { title: `${inr(-row.amount)} cash out of the bank`, body: `log cash spends in left. · ${todayLine(n)}`, notify: true }
    case "cardbill": return { title: `card bill paid · ${inr(row.amount)}`, body: todayLine(n), notify: true }
    case "transfer": return { title: `${inr(Math.abs(row.amount))} moved between your accounts`, body: `not spending · ${todayLine(n)}`, notify: true }
    case "income": return { title: `${inr(row.amount, true)} · ${row.what}`, body: `${todayLine(n)} · ${free}`, notify: true }
    case "refund": return { title: `${inr(row.amount, true)} refund · ${row.what}`, body: todayLine(n), notify: true }
    default: return { title: `${amt(row.amount)} · ${row.what}`, body: todayLine(n), notify: false }
  }
}

function describeRow(row, s) {
  const lines = [`${inr(row.amount, true)} · ${row.what}`, tag(row), acctLabel(row.account, s)]
  if (row.ref) lines.push(`ref …${row.ref.slice(-4)}`)
  if (row.bal !== null && row.bal !== undefined) lines.push(`bank balance after: ${inr(row.bal)}`)
  if (row.src === "paste" && daysBetween(row.time, new Date()) > 0) lines.push(`dated ${dmon(row.time).toLowerCase()}`)
  return lines.join("\n")
}

// ─── storage (iCloud Drive › Scriptable › left) ──────────────────

function store() {
  let fm
  try { fm = FileManager.iCloud(); fm.documentsDirectory() } catch (e) { fm = FileManager.local() }
  const dir = fm.joinPath(fm.documentsDirectory(), "left")
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true)
  return { fm, path: name => fm.joinPath(dir, name) }
}
async function readFile(S, name) {
  const p = S.path(name)
  if (!S.fm.fileExists(p)) return null
  try { if (!S.fm.isFileDownloaded(p)) await S.fm.downloadFileFromiCloud(p) } catch (e) {}
  return S.fm.readString(p)
}
function writeFile(S, name, text) { S.fm.writeString(S.path(name), text) }
async function load(S) {
  const txt = await readFile(S, "settings.json")
  let settings = Object.assign({}, DEFAULTS)
  if (txt) { try { settings = Object.assign(settings, JSON.parse(txt)) } catch (e) {} }
  settings.accounts = settings.accounts || []
  settings.bills = settings.bills || []
  return { S, settings, rows: fromCsv((await readFile(S, "tape.csv")) || "") }
}
function saveRows(db) { writeFile(db.S, "tape.csv", toCsv(db.rows.slice().sort(byTime))) }
function saveSettings(db) { writeFile(db.S, "settings.json", JSON.stringify(db.settings, null, 2)) }

function runURL(q) {
  let name = "left"
  try { name = Script.name() } catch (e) {}
  return "scriptable:///run/" + encodeURIComponent(name) + (q ? "?" + q : "")
}

async function notify(title, body, laterId) {
  try {
    const N = new Notification()
    N.title = title
    N.body = body
    N.threadIdentifier = "left"
    N.openURL = runURL()
    // a stencil notification waits a little for the AI's answer, which replaces it
    if (laterId) { N.identifier = laterId; N.setTriggerDate(new Date(Date.now() + AI_WAIT * 1000)) }
    await N.schedule()
  } catch (e) {}
}
async function unnotify(id) { try { await Notification.removePending([id]) } catch (e) {} }

// ─── capture: Shortcuts hands us a text message, then the AI's answer ─
//
// call 1  a text message arrives (the Shortcut's own regex has usually filtered it already).
//         If it mentions money (₹, Rs, INR — or "debited"/"credited" with a number, which is
//         how SBI writes it), the stencil reads it straight away as a backup and we hand the
//         Shortcut a question for Apple's on-device AI. Anything else gets a no-op question.
// call 2  the AI's answer arrives (a dictionary). Both agree, or only the AI could read it:
//         saved. They disagree: you're asked. The AI never answers (older iPhone, AI off,
//         phone locked): the stencil's reading stays, so nothing is lost.

const MONEY_RE = /(?:₹|\brs\.?|\binr)\s*\d|\b(?:debited|credited)\b.{0,40}\d/i
const SURE_NO = ["a one-time password", "a payment that hasn't happened yet", "a failed payment", "a payment request, not a payment", "a bill reminder", "an offer or ad", "an autopay update, not a payment"]
const AI_WAIT = 45 // seconds a stencil notification waits for the AI before going out anyway
// when there's nothing for the AI to read, the Shortcut still runs Use Model — give it a question it can't mistake
const NOTHING = "Reply with a dictionary: id: none, is_transaction: false, amount: 0."

// the long instructions older Shortcuts use: the two-run Shortcut has left. write them (plus an id).
// The simple Shortcut uses the short prompt in scriptable/prompt.txt (type, amount, name, account, card).
const AI_RULES = [
  "You read one text message for a personal budget app in India. Answer with a dictionary that has exactly these keys:",
  "is_transaction: true only if money has already moved into or out of the reader's own bank account, card or wallet. false for OTPs, offers, reminders, anything that \"will be\" debited, payment requests, failed payments, autopay set-up, and messages from people.",
  "direction: \"out\" if money left the reader (debited, sent, spent, paid, withdrawn). \"in\" if money arrived (credited, received, refunded). If the reader's account was debited and someone else was credited, it is \"out\".",
  "amount: the amount that moved, as a number. Never the balance or the credit limit.",
  "counterparty: the shop or person on the other side, or \"\".",
  "account_last4: the last 4 digits of the reader's account or card, or \"\".",
  "credit_card: true if it happened on a credit card, otherwise false.",
  "kind: one of purchase, atm, card_bill, refund, salary, autopay, other. card_bill means paying a credit card bill from a bank account.",
  "balance_after: the available balance after it, as a number, or \"\".",
  "reference: the UPI or reference number, or \"\".",
]

function aiPrompt(id, sms) {
  return [AI_RULES[0], `id: copy exactly: ${id}`].concat(AI_RULES.slice(1), ["", "Message:", sms]).join("\n")
}

// the AI's answer, as a dictionary or as text holding JSON → a tidy reading (null if it isn't one)
function readAi(v) {
  let o = v
  if (typeof v === "string") {
    const m = v.match(/\{[\s\S]*\}/)
    if (m) { try { o = JSON.parse(m[0]) } catch (e) { return null } }
    else {
      // plain "key: value" lines, in case the model's Output was left on Text
      o = {}
      for (const line of v.split(/\n/)) {
        const kv = line.match(/^\s*[-*•]?\s*"?([A-Za-z_ ]{2,20}?)"?\s*[:=]\s*(.*?)\s*,?\s*$/)
        if (kv) o[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1")
      }
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null
  const k = {}
  for (const key of Object.keys(o)) k[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = o[key]
  const s = x => (x === null || x === undefined ? "" : String(x).trim())
  const yes = x => x === true || x === 1 || /^(?:true|yes|1)$/i.test(s(x))
  const first = (...keys) => { for (const x of keys) if (s(k[x])) return s(k[x]); return "" }
  // short prompt: one "type" word says if, and which way, money moved
  const t = typeOfAi(s(k.type))
  if ((!t && !("istransaction" in k)) || !("amount" in k)) return null
  const d = s(k.direction).toLowerCase()
  const kind = t ? t.kind : s(k.kind).toLowerCase().replace(/[\s-]+/g, "_")
  return {
    id: s(k.id), isTx: t ? t.isTx : yes(k.istransaction),
    dir: t ? t.dir : /^(?:in|credit)/.test(d) ? 1 : /^(?:out|debit)/.test(d) ? -1 : 0,
    amount: num(k.amount), what: cleanName(first("counterparty", "name")),
    last4: first("accountlast4", "account").replace(/\D/g, "").slice(-4),
    card: kind !== "atm" && yes(k.creditcard !== undefined ? k.creditcard : k.card), // cash comes out of the bank
    kind, bal: num(k.balanceafter),
    ref: s(k.reference).replace(/[^a-z0-9]/gi, "").toLowerCase(),
    sms: inputText(k.message !== undefined ? k.message : k.sms !== undefined ? k.sms : k.shortcutinput),
  }
}

// the short prompt's type word → { isTx, dir, kind } (null if it isn't one we know)
function typeOfAi(v) {
  const t = String(v || "").toLowerCase().replace(/[\s-]+/g, "_")
  if (!t) return null
  const r = (isTx, dir, kind) => ({ isTx, dir, kind })
  if (/^(?:none|no|null|n\/?a|not|nothing)\b/.test(t)) return r(false, 0, "")
  if (/card_?bill|bill_?payment/.test(t)) return r(true, -1, "card_bill")
  if (/refund|reversal|reversed/.test(t)) return r(true, 1, "refund")
  if (/salary/.test(t)) return r(true, 1, "salary")
  if (/^(?:atm|withdraw)/.test(t)) return r(true, -1, "atm")
  if (/^(?:spent|spend|sent|paid|pay|debit|purchase|out|autopay)/.test(t)) return r(true, -1, /autopay/.test(t) ? "autopay" : "purchase")
  if (/^(?:received|receive|credit|in\b|deposit|income)/.test(t)) return r(true, 1, "other")
  return null
}

// safety checks on the AI's numbers: the amount must be in the message, and must not be the balance
function aiTrusted(a, sms) {
  if (!a.amount || a.amount <= 0 || !a.dir) return "the AI's answer was incomplete"
  const near = (xs, v) => xs.some(n => Math.abs(n - v) < 0.005)
  if (!near((String(sms).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(money), a.amount)) return "the AI's amount isn't in the SMS"
  const t = String(sms).toLowerCase()
  const balish = []
  const re = /(?:bal(?:ance)?|limit|lmt|avl|avail|available|outstanding)[^0-9]{0,24}?(\d[\d,]*(?:\.\d+)?)/g
  let m
  while ((m = re.exec(t))) balish.push(money(m[1]))
  if (near(balish, a.amount) && !near(amountsIn(t), a.amount)) return "the AI picked the balance, not the amount"
  return null
}

function aiToParsed(a, sms, now) {
  const raw = String(sms).replace(/\s+/g, " ").trim(), t = raw.toLowerCase()
  return {
    ok: true, raw, dir: a.dir, amount: a.amount, type: a.card ? "card" : "bank",
    account: a.card ? "card" + a.last4 : (a.last4 || null), bank: bankOf(t), mentioned: mentionedIn(t),
    bal: a.card ? null : a.bal, ref: a.ref, what: a.what,
    atm: a.kind === "atm", cardBill: a.kind === "card_bill", refund: a.kind === "refund", salary: a.kind === "salary",
    autopay: a.kind === "autopay" || AUTOPAY_RE.test(t),
    date: dateIn(t, now),
  }
}

function reading(r) { return { kind: r.kind, amount: r.amount, what: r.what, slot: r.slot, account: r.account, ref: r.ref, bal: r.bal, bill: r.bill } }
function readingLine(x) { return x.no ? x.no : `${amt(x.amount)} · ${label(x)} (${tag(x)})` }
function toReview(row, ai, rules) {
  Object.assign(row, { kind: "review", amount: 0, what: "AI and stencil disagree", slot: "", bill: "", reader: "ask", alt: JSON.stringify({ ai, rules }) })
}
function aiActive(s, now) { return !!s.aiSeen && now - new Date(s.aiSeen) < 30 * 864e5 }

async function readPending(S) { try { return JSON.parse((await readFile(S, "pending.json")) || "null") } catch (e) { return null } }
function dropPending(S) { try { const p = S.path("pending.json"); if (S.fm.fileExists(p)) S.fm.remove(p) } catch (e) {} }
async function dropStalePending(S, now) { const p = await readPending(S); if (p && now - new Date(p.at) > 10 * 60 * 1000) dropPending(S) }

function inputText(v) {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") {
    if (v.startsWith("/") && v.length < 400) {
      try { const fm = FileManager.local(); if (fm.fileExists(v)) return fm.readString(v) || "" } catch (e) {}
    }
    return v
  }
  if (typeof v === "number") return String(v)
  if (Array.isArray(v)) return v.map(inputText).join("\n")
  if (typeof v === "object") {
    for (const k of ["content", "Content", "body", "Body", "text", "Text", "message", "Message"]) if (typeof v[k] === "string") return v[k]
    return JSON.stringify(v)
  }
  return String(v)
}

function noteSeen(S, seen, result) {
  seen.result = result
  try { writeFile(S, "last-seen.json", JSON.stringify(seen)) } catch (e) {}
}

// the stencil's first look: saves its own reading as a backup, and notes what the AI is asked about
// (oneRun: the Shortcut already has the AI's answer, so nothing is held for later)
async function firstLook(S, text, now, oneRun) {
  if (!MONEY_RE.test(text)) return { done: "ignored — no amount in it" }
  const db = await load(S)
  const p = parseSms(text, now)
  const later = !oneRun && aiActive(db.settings, now)
  const tell = async (title, body, id) => {
    if (oneRun || !db.settings.notify) return ""
    await notify(title, body, later ? "left-" + id : null)
    return later ? "later" : "now"
  }
  const pend = { id: newId(), at: iso(now), sms: text, rowId: "", told: "" }
  let result = "asked the AI · stencil: " + (p.ok ? "a payment" : p.why)
  if (p.ok) {
    const row = buildRow(p, db, now, "sms")
    if (isDup(row, db.rows)) return { done: "already had this one" }
    row.reader = "rules"
    db.rows.push(row)
    pairTransfer(db.rows, row)
    if (learnAccount(db.settings, p, row)) saveSettings(db)
    saveRows(db)
    pend.rowId = row.id
    const msg = describeCapture(row, compute(db.rows, db.settings, now))
    if (msg.notify) pend.told = await tell(msg.title, msg.body, row.id)
    result = msg.title + " · asked the AI"
  } else if (p.why === "review") {
    if (db.rows.some(r => r.kind === "review" && r.raw === p.raw)) return { done: "already had this one" }
    const row = reviewRow(p, now)
    row.reader = "rules"
    db.rows.push(row)
    saveRows(db)
    pend.rowId = row.id
    pend.told = await tell("a bank SMS needs a look", "left. couldn't read it. open left. › recent", row.id)
  }
  return { pend, result }
}

async function capture(param) {
  const now = new Date()
  const S = store()
  const ai = readAi(param)
  // one run: the Shortcut tucked the original text into the AI's answer (key "message")
  if (ai && ai.sms) {
    const seen = { at: iso(now), type: "AI answer + message", chars: ai.sms.length, result: "" }
    const f = await firstLook(S, ai.sms, now, true)
    if (f.done) { noteSeen(S, seen, f.done); return "left.: " + f.done }
    return applyAi(S, ai, now, f.pend)
  }
  if (ai) {
    // simple Shortcut: triggers filter → Use Model → Run Script with only the AI's answer. Trust it.
    if (!ai.id) {
      const pend = await readPending(S)
      const waiting = pend && now - new Date(pend.at) < 2 * 60 * 1000
      if (!waiting) return saveAi(S, ai, now)
    }
    return applyAi(S, ai, now)
  }
  // two runs: a text message arrives first, the AI's answer comes in a second run
  const text = inputText(param)
  // privacy: only the time, type and length of a message are noted — never its words
  const seen = { at: iso(now), type: Array.isArray(param) ? "list" : typeof param, chars: text.length, result: "" }
  const f = await firstLook(S, text, now, false)
  if (f.done) {
    if (f.done.startsWith("ignored")) await dropStalePending(S, now)
    noteSeen(S, seen, f.done)
    return NOTHING
  }
  writeFile(S, "pending.json", JSON.stringify(f.pend))
  noteSeen(S, seen, f.result)
  return aiPrompt(f.pend.id, text)
}

// the simple path: the AI's answer is the whole story — no text, no second opinion
async function saveAi(S, ai, now) {
  const seen = { at: iso(now), type: "AI answer", chars: 0, result: "" }
  const done = r => { noteSeen(S, seen, r); return "left.: " + r }
  if (!ai.isTx) return done("not a payment (AI)")
  // fill small gaps: a minus sign or the kind can say which way the money went
  const byKind = { refund: 1, salary: 1, purchase: -1, atm: -1, card_bill: -1, autopay: -1 }
  ai = Object.assign({}, ai, { dir: ai.dir || (ai.amount < 0 ? -1 : byKind[ai.kind] || 0), amount: Math.abs(ai.amount || 0) })
  if (!(ai.amount > 0) || !ai.dir) return done("the AI's answer was incomplete")
  const db = await load(S)
  db.settings.aiSeen = iso(now)
  if (ai.kind === "card_bill") {
    // paid from one of your bank accounts → the bank side; on an account that isn't a bank of yours →
    // it's the card company's "payment received" text, so it lowers what the card owes
    const fromBank = !ai.last4 || (db.settings.accounts || []).some(a => sameBank(a.id, ai.last4))
    ai = Object.assign(ai, fromBank ? { card: false, dir: -1 } : { card: true, dir: 1, kind: "other" })
  }
  const ap = aiToParsed(ai, "", now)
  const row = buildRow(ap, db, now, "sms")
  row.reader = "ai"
  if (isDup(row, db.rows)) { saveSettings(db); return done("already had this one") }
  db.rows.push(row)
  pairTransfer(db.rows, row)
  learnAccount(db.settings, ap, row)
  saveSettings(db)
  saveRows(db)
  const msg = describeCapture(row, compute(db.rows, db.settings, now))
  if (db.settings.notify && msg.notify) await notify(msg.title, msg.body)
  return done(msg.title)
}

async function applyAi(S, ai, now, given) {
  const seen = { at: iso(now), type: given ? "AI answer + message" : "AI answer", chars: given ? String(given.sms).length : 0, result: "" }
  const pend = given || await readPending(S)
  // the answer must belong to the message waiting for it (or carry no id and arrive within 5 minutes)
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  const fresh = pend && now - new Date(pend.at) < 2 * 60 * 1000
  const inSms = pend && ai.amount > 0 && (String(pend.sms).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(money).some(n => Math.abs(n - ai.amount) < 0.005)
  const mine = given || (pend && (ai.id ? norm(pend.id).length > 0 && norm(ai.id).includes(norm(pend.id)) : fresh && inSms))
  if (!mine) {
    noteSeen(S, seen, "an AI answer came with no message waiting")
    return "left.: nothing waiting for the AI"
  }
  if (!given) dropPending(S)
  const db = await load(S)
  db.settings.aiSeen = iso(now)
  const sms = pend.sms
  const raw = String(sms).replace(/\s+/g, " ").trim()
  const p = parseSms(sms, now)
  const prov = pend.rowId ? db.rows.find(r => r.id === pend.rowId) : null
  const live = prov && prov.kind !== "review" ? prov : null // the stencil's confident reading, if any
  if (prov) await unnotify("left-" + prov.id)
  let msg = null, result
  const ask = (row, aiR, rulesR, text) => {
    toReview(row, aiR, rulesR)
    msg = { title: "check this one", body: text, notify: true }
    return "asked you — " + text
  }
  const quiet = m => (pend.told === "now" ? null : m) // the stencil already told you, and nothing changed

  if (!ai.isTx) {
    if (live) result = ask(live, { no: "not a payment" }, reading(live), `AI says it isn't a payment · the stencil read ${readingLine(live)}`)
    else if (prov) { Object.assign(prov, { kind: "ignore", what: "not a payment (AI)", reader: "ai" }); result = "AI: not a payment" }
    else result = "AI: not a payment"
  } else {
    const bad = aiTrusted(ai, sms)
    if (bad) {
      if (live) {
        live.reader = "rules"
        msg = quiet(describeCapture(live, compute(db.rows, db.settings, now)))
        result = `${bad} — kept the stencil's reading`
      } else {
        const row = prov || reviewRow({ raw, account: "" }, now)
        if (!prov) db.rows.push(row)
        Object.assign(row, { reader: "ai", alt: JSON.stringify({ ai: { no: bad } }) })
        msg = { title: "a bank SMS needs a look", body: bad, notify: true }
        result = bad
      }
    } else {
      const ap = aiToParsed(ai, sms, now)
      const aiRow = buildRow(ap, db, now, "sms")
      aiRow.reader = "ai"
      const isCard = r => (r.account || "").startsWith("card")
      if (live) {
        const same = Math.abs(Math.abs(live.amount) - Math.abs(aiRow.amount)) < 0.01 && Math.sign(live.amount) === Math.sign(aiRow.amount) && isCard(live) === isCard(aiRow)
        if (same) {
          if (ai.what && live.kind !== "transfer") { live.what = ai.what; if (live.kind === "spend") live.slot = ap.autopay ? "BL" : slotFor(ai.what) }
          live.reader = "both"
          msg = quiet(describeCapture(live, compute(db.rows, db.settings, now)))
          result = "AI and stencil agree"
        } else result = ask(live, reading(aiRow), reading(live), `AI read ${readingLine(aiRow)} · the stencil read ${readingLine(live)}`)
      } else if (!p.ok && SURE_NO.includes(p.why)) {
        const row = reviewRow({ raw, account: aiRow.account }, now)
        db.rows.push(row)
        result = ask(row, reading(aiRow), { no: p.why }, `AI read ${readingLine(aiRow)} · the stencil thinks it's ${p.why}`)
      } else {
        // the stencil couldn't read it — the AI's reading is used on its own
        const others = db.rows.filter(r => r !== prov)
        if (isDup(aiRow, others)) {
          db.rows = others
          result = "already had this one"
        } else {
          let target = aiRow
          if (prov) { const keep = prov.id; Object.assign(prov, aiRow, { id: keep, alt: "" }); target = prov } else db.rows.push(aiRow)
          pairTransfer(db.rows, target)
          learnAccount(db.settings, ap, target)
          msg = describeCapture(target, compute(db.rows, db.settings, now))
          result = msg.title + " · read by AI"
        }
      }
    }
  }
  saveSettings(db)
  saveRows(db)
  if (msg && msg.notify && db.settings.notify) await notify(msg.title, msg.body)
  noteSeen(S, seen, result)
  return "left.: " + result
}

// ─── widgets ─────────────────────────────────────────────────────

const LIGHT = { bg: "#FCFCFA", ink: "#0E0E10", ink2: "#4A4A47", ink3: "#6E6E6A", line: "#DCDCD7", bar: "#BDBDB7", bal: "#2B46C8", fixed: "#8E8E89", free: "#1E7A47", today: "#F2541B" }
const DARK = { bg: "#0C0C0E", ink: "#EDEDE8", ink2: "#B4B4AE", ink3: "#8A8A85", line: "#2C2C30", bar: "#3A3A3F", bal: "#6B84FF", fixed: "#CFCFC8", free: "#3FD483", today: "#FF6A2B" }

function palette(theme) {
  const P = {}
  for (const k of Object.keys(LIGHT)) {
    const l = new Color(LIGHT[k]), d = new Color(DARK[k])
    P[k] = theme === "dark" ? d : theme === "light" ? l : Color.dynamic(l, d)
  }
  return P
}

const mono = s => Font.regularMonospacedSystemFont(s)
const thin = s => Font.thinSystemFont(s)

function T(parent, s, font, color, o) {
  o = o || {}
  const t = parent.addText(String(s))
  t.font = font
  t.textColor = color
  t.lineLimit = o.lines || 1
  if (o.scale) t.minimumScaleFactor = o.scale
  if (o.right) t.rightAlignText()
  if (o.center) t.centerAlignText()
  return t
}
function hstack(parent, spacing) { const s = parent.addStack(); s.layoutHorizontally(); if (spacing !== undefined) s.spacing = spacing; return s }
function vstack(parent, spacing) { const s = parent.addStack(); s.layoutVertically(); if (spacing !== undefined) s.spacing = spacing; return s }
function box(parent, w, h, fill, stroke) {
  const s = parent.addStack()
  s.size = new Size(w, h)
  if (fill) s.backgroundColor = fill
  if (stroke) { s.borderColor = stroke; s.borderWidth = 1 }
  return s
}
function litCount(n, count) {
  if (n.share <= 0 || n.today <= 0) return 0
  return Math.max(1, Math.min(count, Math.round(count * n.today / n.share)))
}
function meter(parent, n, P, count, w, h, gap) {
  const row = hstack(parent, gap)
  const lit = litCount(n, count)
  for (let i = 0; i < count; i++) box(row, w, h, i < lit ? P.today : null, i < lit ? null : P.line)
  return row
}
function strip(parent, n, P, w, h, gap) {
  const row = hstack(parent, gap)
  for (let i = 1; i <= n.cyc.length; i++) {
    const past = i < n.cyc.dayNo, now = i === n.cyc.dayNo
    box(row, w, h, past ? P.ink : now ? P.today : null, past || now ? null : P.line)
  }
  return row
}
function hero(parent, v, P, size) {
  const row = hstack(parent, 2)
  row.topAlignContent()
  T(row, v < 0 ? "−₹" : "₹", mono(Math.round(size * 0.28)), P.today)
  T(row, group(v), thin(size), P.today, { scale: 0.4 })
  return row
}
function dot(parent, n, P) {
  const d = box(parent, 6, 6, n.warnings.length ? P.today : P.ink)
  d.cornerRadius = 3
  return d
}
function head(parent, n, P) {
  const row = hstack(parent)
  row.centerAlignContent()
  T(row, "TODAY", mono(10), P.ink2)
  row.addSpacer()
  dot(row, n, P)
  row.addSpacer(5)
  T(row, n.lastSms ? when(n.lastSms, n.now) : "—", mono(9), P.ink3)
  return row
}
function todayBlock(parent, n, P) {
  head(parent, n, P)
  parent.addSpacer()
  hero(parent, n.today, P, 52)
  parent.addSpacer(3)
  T(parent, `of ${inr(n.share)} today`, mono(9.5), P.ink3, { scale: 0.7 })
  parent.addSpacer(9)
  meter(parent, n, P, 16, 6, 7, 2)
}
function stat(parent, label, value, color, P) {
  const row = hstack(parent)
  row.centerAlignContent()
  box(row, 7, 7, color)
  row.addSpacer(6)
  T(row, label, mono(9), P.ink2)
  row.addSpacer(8)
  row.addSpacer()
  T(row, value, mono(13), P.ink, { scale: 0.7 })
}
function tapeRows(parent, n, P, count, size) {
  const rows = n.tape.slice(0, count)
  if (!rows.length) { T(parent, "nothing yet — bank SMS show up here", mono(9), P.ink3, { lines: 2 }); return }
  rows.forEach((r, i) => {
    if (i) parent.addSpacer(5)
    const h = hstack(parent)
    h.centerAlignContent()
    const tm = hstack(h)
    tm.size = new Size(38, 0)
    T(tm, when(r.time, n.now), mono(size - 2.5), P.ink3)
    T(h, label(r), Font.regularSystemFont(size), P.ink, { scale: 0.75 })
    h.addSpacer()
    T(h, r.kind === "review" ? "?" : amt(r.amount), mono(size), r.amount > 0 ? P.free : P.ink)
  })
}
function footer(parent, n, P) {
  const f = hstack(parent)
  T(f, `DAY ${pad(n.cyc.dayNo)}/${n.cyc.length}`, mono(8.5), P.ink3)
  f.addSpacer()
  T(f, `PAYDAY ${dmon(n.cyc.next)}`, mono(8.5), P.ink3)
}

function wSmall(n, P) {
  const w = new ListWidget()
  w.backgroundColor = P.bg
  w.setPadding(14, 15, 14, 15)
  todayBlock(w, n, P)
  return w
}

function wMedium(n, P, tape) {
  const w = new ListWidget()
  w.backgroundColor = P.bg
  w.setPadding(14, 15, 14, 15)
  const row = hstack(w)
  const L = vstack(row)
  L.size = new Size(126, 0)
  todayBlock(L, n, P)
  row.addSpacer(13)
  box(row, 1, 128, P.line)
  row.addSpacer(13)
  const R = vstack(row)
  if (tape) {
    tapeRows(R, n, P, 3, 11.5)
    R.addSpacer()
    const f = hstack(R)
    T(f, `DAY ${pad(n.cyc.dayNo)}/${n.cyc.length}`, mono(8.5), P.ink3)
    f.addSpacer()
    T(f, `${compact(n.free)} FREE`, mono(8.5), P.ink3)
  } else {
    stat(R, "BAL", inr(n.bal), P.bal, P)
    R.addSpacer()
    stat(R, "FIXED", inr(n.fixed), P.fixed, P)
    R.addSpacer()
    stat(R, "FREE", inr(n.free), P.free, P)
    R.addSpacer()
    const gap = 1.2
    const sw = Math.max(2, Math.floor((138 - (n.cyc.length - 1) * gap) / n.cyc.length * 2) / 2)
    strip(R, n, P, sw, 9, gap)
    R.addSpacer(5)
    footer(R, n, P)
  }
  return w
}

function wLarge(n, P) {
  const w = new ListWidget()
  w.backgroundColor = P.bg
  w.setPadding(16, 16, 14, 16)
  const top = hstack(w)
  top.centerAlignContent()
  T(top, "left.", thin(17), P.ink)
  top.addSpacer()
  dot(top, n, P)
  top.addSpacer(5)
  T(top, n.lastSms ? `LAST SMS ${when(n.lastSms, n.now)}` : "NO SMS YET", mono(9), P.ink3)
  w.addSpacer(10)
  const mid = hstack(w)
  mid.bottomAlignContent()
  const L = vstack(mid, 2)
  T(L, "TODAY", mono(10), P.ink2)
  hero(L, n.today, P, 54)
  mid.addSpacer()
  const R = vstack(mid, 3)
  T(R, `of ${inr(n.share)}`, mono(10), P.ink3, { right: true })
  T(R, `${n.entries} ${n.entries === 1 ? "entry" : "entries"} today`, mono(10), P.ink3, { right: true })
  w.addSpacer(8)
  meter(w, n, P, 16, 15, 8, 3.5)
  w.addSpacer(12)
  const cols = hstack(w)
  const items = [["BAL", n.bal, P.bal], ["FIXED", n.fixed, P.fixed], ["FREE", n.free, P.free]]
  items.forEach(([label, v, color], i) => {
    if (i) cols.addSpacer()
    const col = vstack(cols, 3)
    const h = hstack(col)
    h.centerAlignContent()
    box(h, 7, 7, color)
    h.addSpacer(5)
    T(h, label, mono(9), P.ink2)
    T(col, inr(v), mono(13), P.ink, { scale: 0.7 })
  })
  w.addSpacer(12)
  const H = 46
  const max = Math.max(1, n.share, ...n.days.map(d => d.spent))
  const bars = hstack(w, 8)
  bars.bottomAlignContent()
  n.days.forEach((d, i) => {
    const col = vstack(bars, 3)
    col.size = new Size(35, H + 14)
    col.centerAlignContent()
    col.addSpacer()
    box(col, 35, Math.max(2, Math.round(H * Math.max(0, d.spent) / max)), i === 6 ? P.today : P.bar)
    T(col, pad(d.d.getDate()), mono(8), i === 6 ? P.ink : P.ink3, { center: true })
  })
  w.addSpacer(10)
  tapeRows(w, n, P, 3, 11)
  w.addSpacer()
  const foot = hstack(w)
  foot.centerAlignContent()
  T(foot, `DAY ${pad(n.cyc.dayNo)}/${n.cyc.length} · PAYDAY ${dmon(n.cyc.next)}`, mono(8.5), P.ink3)
  foot.addSpacer()
  const add = hstack(foot)
  add.url = runURL("do=spend")
  T(add, "+ CASH", mono(9), P.ink)
  return w
}

function ring(frac) {
  const S = 120, lw = 9, r = S / 2 - lw / 2 - 2
  const ctx = new DrawContext()
  ctx.size = new Size(S, S)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const track = new Path()
  track.addEllipse(new Rect(S / 2 - r, S / 2 - r, 2 * r, 2 * r))
  ctx.addPath(track)
  ctx.setStrokeColor(new Color("#FFFFFF", 0.25))
  ctx.setLineWidth(lw)
  ctx.strokePath()
  if (frac > 0) {
    const pts = []
    const steps = Math.max(2, Math.ceil(90 * frac))
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * frac * i / steps
      pts.push(new Point(S / 2 + r * Math.cos(a), S / 2 + r * Math.sin(a)))
    }
    const arc = new Path()
    arc.addLines(pts)
    ctx.addPath(arc)
    ctx.setStrokeColor(Color.white())
    ctx.setLineWidth(lw)
    ctx.strokePath()
  }
  return ctx.getImage()
}

function wRect(n) {
  const W = Color.white(), D = new Color("#FFFFFF", 0.55)
  const w = new ListWidget()
  const top = hstack(w)
  top.bottomAlignContent()
  T(top, "TODAY", mono(11), D)
  top.addSpacer(6)
  T(top, inr(n.today), Font.mediumSystemFont(21), W, { scale: 0.6 })
  w.addSpacer(5)
  const lit = litCount(n, 16)
  const row = hstack(w, 2)
  for (let i = 0; i < 16; i++) box(row, 6.5, 6, i < lit ? W : new Color("#FFFFFF", 0.22))
  w.addSpacer(5)
  T(w, `FREE ${compact(n.free)} · ${n.cyc.daysLeft} DAYS`, mono(10), D, { scale: 0.7 })
  return w
}

function wCircle(n) {
  const w = new ListWidget()
  w.addAccessoryWidgetBackground = true
  w.backgroundImage = ring(n.share > 0 ? Math.max(0, Math.min(1, n.today / n.share)) : 0)
  const v = Math.abs(n.today) < 10000 ? (n.today < 0 ? "−" : "") + group(n.today) : compact(n.today).replace("₹", "")
  w.addSpacer()
  const h = hstack(w)
  h.addSpacer()
  const c = vstack(h)
  c.centerAlignContent()
  T(c, v, Font.mediumSystemFont(16), Color.white(), { scale: 0.5, center: true })
  T(c, "TODAY", mono(7), new Color("#FFFFFF", 0.7), { center: true })
  h.addSpacer()
  w.addSpacer()
  return w
}

function wInline(n) {
  const w = new ListWidget()
  T(w, todayLine(n), Font.regularSystemFont(14), Color.white())
  return w
}

function wNote(family, P, title, line) {
  const w = new ListWidget()
  if (family && family.startsWith("accessory")) { T(w, `left. · ${line}`, mono(11), Color.white(), { lines: 2 }); return w }
  w.backgroundColor = P.bg
  T(w, title, thin(28), P.ink)
  w.addSpacer(6)
  T(w, line, mono(10), P.ink3, { lines: 3 })
  return w
}

async function buildWidget(family, param) {
  const words = String(param || "").toLowerCase().split(/[\s,]+/)
  const P = palette(words.includes("dark") ? "dark" : words.includes("light") ? "light" : null)
  let w
  try {
    const db = await load(store())
    if (!db.settings.setupAt && !db.rows.length) w = wNote(family, P, "left.", "tap to set up")
    else {
      const n = compute(db.rows, db.settings, new Date())
      if (family === "medium") w = wMedium(n, P, words.includes("tape"))
      else if (family === "large" || family === "extraLarge") w = wLarge(n, P)
      else if (family === "accessoryRectangular") w = wRect(n)
      else if (family === "accessoryCircular") w = wCircle(n)
      else if (family === "accessoryInline") w = wInline(n)
      else w = wSmall(n, P)
    }
  } catch (e) {
    w = wNote(family, P, "left.", "couldn't read your data — open left. once")
  }
  w.url = runURL()
  // ask iOS to redraw in 5 minutes; iOS decides the real timing
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)
  return w
}

// ─── the app: what you see when you tap left. in Scriptable ──────

async function form(title, message, fields, actions) {
  const a = new Alert()
  a.title = title
  a.message = message || ""
  fields.forEach(f => {
    const tf = a.addTextField(f.hint || "", f.value === undefined || f.value === null ? "" : String(f.value))
    if (f.num === "int") tf.setNumberPadKeyboard()
    else if (f.num) tf.setDecimalPadKeyboard()
  })
  actions.forEach(x => a.addAction(x))
  a.addCancelAction("cancel")
  const i = await a.presentAlert()
  if (i < 0) return null
  return { action: i, values: fields.map((f, k) => String(a.textFieldValue(k) || "").trim()) }
}
async function choose(title, message, options, alert) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  options.forEach(o => a.addAction(o))
  a.addCancelAction("cancel")
  return alert ? a.presentAlert() : a.presentSheet()
}
async function tell(title, message) {
  const a = new Alert()
  a.title = title
  a.message = message || ""
  a.addAction("ok")
  await a.presentAlert()
}

function addRow(table, title, subtitle, onSelect, o) {
  o = o || {}
  const P = palette()
  const r = new UITableRow()
  r.height = o.height || (subtitle ? 60 : 46)
  const c = r.addText(title, subtitle || "")
  c.titleFont = o.titleFont || Font.regularSystemFont(17)
  if (o.titleColor) c.titleColor = o.titleColor
  c.subtitleFont = mono(11)
  c.subtitleColor = o.subColor || P.ink3
  if (o.right !== undefined) {
    const rc = r.addText(String(o.right), "")
    rc.rightAligned()
    rc.titleFont = mono(15)
    if (o.rightColor) rc.titleColor = o.rightColor
    rc.widthWeight = 30
    c.widthWeight = 70
  }
  if (onSelect) { r.onSelect = onSelect; r.dismissOnSelect = false }
  table.addRow(r)
  return r
}
function gap(table, h) { const r = new UITableRow(); r.height = h || 16; table.addRow(r) }

async function pickBank(db, title) {
  const ids = bankIds(db.rows, db.settings)
  if (!ids.length) return "bank"
  if (ids.length === 1) return ids[0]
  const i = await choose(title, null, ids.map(id => acctLabel(id, db.settings)))
  return i < 0 ? null : ids[i]
}
async function pickSlot(message) {
  const i = await choose("which slot?", message || null, SLOTS.map(([c, nm]) => `${c} · ${nm}`))
  return i < 0 ? null : SLOTS[i][0]
}
function manualRow(kind, amount, what, slot, account, bill) {
  return { id: newId(), time: new Date(), kind, amount, what, slot: slot || "", account, ref: "", bal: null, bill: bill || "", src: "you", raw: "" }
}

async function setup(S) {
  const db = await load(S)
  const s = db.settings
  const hi = await choose("left.", "how much is left, at a glance.\n\nfive quick questions, about a minute. you can change every answer later.", ["start"], true)
  if (hi < 0) return false

  for (;;) {
    const f = await form("1 / 5 · payday", "which day of the month does your salary come in? (1–31)", [{ hint: "e.g. 28", num: "int", value: s.payday > 1 ? s.payday : "" }], ["next"])
    if (!f) return false
    const d = parseInt(f.values[0], 10)
    if (d >= 1 && d <= 31) { s.payday = d; break }
    await tell("that's not a day", "type a number from 1 to 31.")
  }

  const accounts = []
  for (;;) {
    const acts = accounts.length ? ["save", "save + add another", "no more accounts"] : ["save", "save + add another"]
    const f = await form(`2 / 5 · bank account ${accounts.length + 1}`, "open your bank app and copy three things: the bank's name, the last 4 digits of the account number, and the balance right now.", [{ hint: "bank (e.g. hdfc)" }, { hint: "last 4 digits", num: "int" }, { hint: "balance now ₹", num: true }], acts)
    if (!f) return false
    if (f.action === 2) break
    const id = f.values[1].replace(/\D/g, "").slice(-4)
    const bal = num(f.values[2])
    if (id.length < 3 || bal === null) { await tell("almost", "the last 4 digits and the balance are both needed."); continue }
    accounts.push({ id, name: f.values[0].toLowerCase() || "bank", bal })
    if (f.action === 0) break
  }

  let due = 0
  for (;;) {
    const f = await form("3 / 5 · credit card", "what's your credit card bill so far — what you'd pay if you cleared it today? type 0 if you don't use one.", [{ hint: "0", num: true, value: "0" }], ["next"])
    if (!f) return false
    const v = num(f.values[0])
    if (v !== null && v >= 0) { due = v; break }
    await tell("almost", "type an amount, or 0.")
  }

  const bills = []
  const any = await choose("4 / 5 · monthly bills", "money that goes out every month — rent, emi, sip, subscriptions. left. keeps it aside so it never looks spendable.", ["add a bill", "no bills (add later)"], true)
  if (any < 0) return false
  if (any === 0) for (;;) {
    const f = await form(`bill ${bills.length + 1}`, "a name, how much, and which day of the month it goes out.", [{ hint: "name (rent, emi, sip…)" }, { hint: "amount ₹", num: true }, { hint: "day of month (1–31)", num: "int" }], ["save", "save + add another"])
    if (!f) break
    const name = f.values[0].toLowerCase(), amount = num(f.values[1]), day = parseInt(f.values[2], 10)
    if (!name || !amount || !(day >= 1 && day <= 31)) { await tell("almost", "a name, an amount and a day from 1 to 31 — all three."); continue }
    bills.push({ name, amount, day, match: "" })
    if (f.action === 0) break
  }

  const nt = await choose("5 / 5 · after each payment", "want a small notification that says what's left today?", ["yes, notify me", "no thanks"], true)
  s.notify = nt === 0

  const now = new Date()
  s.accounts = accounts.map(a => ({ id: a.id, name: a.name }))
  s.bills = bills
  s.setupAt = iso(now)
  for (const a of accounts) db.rows.push(anchorRow(a.id, a.bal, now, "setup"))
  db.rows.push(anchorRow("card", -due, now, "setup"))
  saveSettings(db)
  saveRows(db)
  const n = compute(db.rows, s, now)
  if (s.notify) await notify("left. is ready", `${todayLine(n)} · ${inr(n.free)} free until payday`)
  await tell("all set", `${todayLine(n)}.\n\nnext: the shortcut that catches bank SMS, then the widget.`)
  return true
}

async function addSpend(S) {
  const db = await load(S)
  const f = await form("+ spend", "money that left without a bank SMS — cash, mostly.", [{ hint: "amount ₹", num: true }, { hint: "what was it? (chai, auto…)" }], ["paid in cash", "from my bank (no SMS came)", "credit card (no SMS came)"])
  if (!f) return
  const amount = num(f.values[0])
  if (!amount || amount <= 0) return tell("no amount", "type how much you paid.")
  const slot = await pickSlot(f.values[1])
  if (!slot) return
  let account = "cash"
  if (f.action === 1) { account = await pickBank(db, "which bank?"); if (!account) return }
  if (f.action === 2) account = "card"
  const what = (f.values[1] || SLOTS.find(x => x[0] === slot)[1]).toLowerCase()
  db.rows.push(manualRow("spend", -amount, what, slot, account))
  saveRows(db)
}

async function addMoney(S) {
  const db = await load(S)
  const f = await form("+ money in", "cash someone gave you, a refund, salary paid in cash…", [{ hint: "amount ₹", num: true }, { hint: "from what? (gift, refund…)" }], ["into cash", "into my bank (no SMS came)"])
  if (!f) return
  const amount = num(f.values[0])
  if (!amount || amount <= 0) return tell("no amount", "type how much came in.")
  const k = await choose("what is it?", null, ["income — salary, a gift, someone paid me back", "a refund for something I bought"])
  if (k < 0) return
  let account = "cash"
  if (f.action === 1) { account = await pickBank(db, "which bank?"); if (!account) return }
  db.rows.push(manualRow(k === 1 ? "refund" : "income", amount, (f.values[1] || (k === 1 ? "refund" : "money in")).toLowerCase(), "", account))
  saveRows(db)
}

async function pasteSms(S) {
  let clip = ""
  try { clip = Pasteboard.pasteString() || "" } catch (e) {}
  const f = await form("paste a bank SMS", "copy a bank SMS in Messages first (press and hold it › copy). it shows up below.", [{ hint: "bank SMS", value: clip }], ["read it"])
  if (!f || !f.values[0]) return
  const now = new Date()
  const p = parseSms(f.values[0], now)
  if (!p.ok) {
    return tell("couldn't read that one", p.why === "review"
      ? "it looks like a bank message, but the amount or direction isn't clear. send it to whoever looks after left. (change the numbers first)."
      : `left. thinks it's ${p.why}.`)
  }
  const db = await load(S)
  const row = buildRow(p, db, now, "paste")
  if (isDup(row, db.rows)) return tell("read as", describeRow(row, db.settings) + "\n\nyou already have this one.")
  const i = await choose("read as", describeRow(row, db.settings), ["add it", "just testing"], true)
  if (i !== 0) return
  db.rows.push(row)
  pairTransfer(db.rows, row)
  if (learnAccount(db.settings, p, row)) saveSettings(db)
  saveRows(db)
}

async function fixRow(S, id) {
  const db = await load(S)
  const r = db.rows.find(x => x.id === id)
  if (!r) return
  const card = (r.account || "").startsWith("card")
  let alt = null
  try { alt = r.alt ? JSON.parse(r.alt) : null } catch (e) {}
  let opts
  if (r.kind === "review") {
    opts = [["it was money out", "out"], ["it was money in", "in"], ["show the SMS", "sms"], ["not mine — ignore it", "ignore"]]
    if (alt && alt.rules && !alt.rules.no) opts.unshift([`the stencil is right: ${readingLine(alt.rules)}`, "rules"])
    if (alt && alt.ai && !alt.ai.no) opts.unshift([`AI is right: ${readingLine(alt.ai)}`, "ai"])
  }
  else if (r.amount < 0 || r.kind === "fixed") opts = [["change slot", "slot"], ["it was a monthly bill", "bill"], ["it paid my credit card bill", "cardbill"], ["moved to my own account", "transfer"], ["it was a normal spend", "spend"], ["show the SMS", "sms"], ["not mine — ignore it", "ignore"]]
  else opts = [["it was income", "income"], ["it was a refund", "refund"], ["came from my own account", "transfer"], ["show the SMS", "sms"], ["not mine — ignore it", "ignore"]]
  if (card) opts = opts.filter(o => !["cardbill", "transfer"].includes(o[1]))
  if (!r.raw) opts = opts.filter(o => o[1] !== "sms")
  opts.push(["delete", "delete"])
  const info = r.kind === "review" && r.raw ? r.raw : `${tag(r)} · ${acctLabel(r.account, db.settings)} · ${dmon(r.time).toLowerCase()} ${hm(r.time)}`
  const i = await choose(`${r.kind === "review" ? "?" : amt(r.amount)} · ${label(r)}`, info, opts.map(o => o[0]))
  if (i < 0) return
  const op = opts[i][1]
  if (op === "sms") return tell("the SMS", r.raw)
  if (op === "ai" || op === "rules") {
    Object.assign(r, alt[op], { reader: "you", alt: "" })
  } else if (op === "delete") {
    const ok = await choose("delete this?", "it'll be gone from tape.csv.", ["delete"], true)
    if (ok !== 0) return
    db.rows = db.rows.filter(x => x.id !== id)
  } else if (op === "slot") {
    const slot = await pickSlot()
    if (!slot) return
    Object.assign(r, { kind: "spend", slot, bill: "" })
  } else if (op === "bill") {
    const bills = db.settings.bills
    if (!bills.length) return tell("no bills yet", "add one in fixed bills first.")
    const bi = await choose("which bill?", null, bills.map(b => `${b.name} · ${inr(b.amount)}`))
    if (bi < 0) return
    Object.assign(r, { kind: "fixed", bill: bills[bi].name, slot: "BL" })
  } else if (op === "out" || op === "in") {
    const f = await form("how much?", r.raw, [{ hint: "amount ₹", num: true }], ["save"])
    const v = f ? num(f.values[0]) : null
    if (!v || v <= 0) return
    if (op === "out") {
      const slot = await pickSlot()
      if (!slot) return
      Object.assign(r, { kind: "spend", amount: -v, slot, what: "payment" })
    } else Object.assign(r, { kind: "income", amount: v, slot: "", what: "money in" })
    if (!r.account) r.account = (db.settings.accounts[0] && db.settings.accounts[0].id) || "bank"
  } else {
    Object.assign(r, { kind: op, bill: "", slot: op === "spend" ? (r.slot || slotFor(r.what)) : "" })
  }
  saveRows(db)
}

async function recent(S) {
  const t = new UITable()
  t.showSeparators = true
  const draw = async () => {
    t.removeAllRows()
    const db = await load(S)
    const now = new Date()
    const P = palette()
    const rows = db.rows.filter(r => r.kind !== "anchor").sort((a, b) => b.time - a.time).slice(0, 80)
    addRow(t, "recent", rows.length ? "tap one to fix it" : "nothing yet — waiting for your first bank SMS", null, { titleFont: thin(30), height: 70 })
    for (const r of rows) {
      const by = r.reader === "ai" ? " · read by AI" : r.reader === "both" ? " · AI agrees" : ""
      addRow(t, `${when(r.time, now).toLowerCase()}  ${label(r)}`, `${tag(r)}${r.kind === "fixed" && r.what !== r.bill ? " · " + r.what : ""} · ${acctLabel(r.account, db.settings)}${by}`,
        async () => { await fixRow(S, r.id); await draw() },
        { right: r.kind === "review" ? "?" : amt(r.amount), rightColor: r.amount > 0 ? P.free : r.kind === "review" ? P.today : null, titleFont: Font.regularSystemFont(15) })
    }
    t.reload()
  }
  await draw()
  await t.present(false)
}

async function editBill(S, name) {
  const db = await load(S)
  const b = db.settings.bills.find(x => x.name === name) || { name: "", amount: "", day: "", match: "" }
  const f = await form(name ? `edit ${name}` : "+ add a bill", "name, amount, day of the month — and, if you like, a word from its bank SMS (like the landlord's name) so left. spots it.", [{ hint: "name (rent, emi, sip…)", value: b.name }, { hint: "amount ₹", num: true, value: b.amount }, { hint: "day of month (1–31)", num: "int", value: b.day }, { hint: "word in the SMS (optional)", value: b.match }], ["save"])
  if (!f) return
  const next = { name: f.values[0].toLowerCase(), amount: num(f.values[1]), day: parseInt(f.values[2], 10), match: f.values[3].toLowerCase() }
  if (!next.name || !next.amount || !(next.day >= 1 && next.day <= 31)) return tell("almost", "a name, an amount and a day from 1 to 31 — all three.")
  if (name) {
    db.settings.bills = db.settings.bills.map(x => x.name === name ? next : x)
    if (next.name !== name) db.rows.forEach(r => { if (r.bill === name) r.bill = next.name })
    saveRows(db)
  } else db.settings.bills.push(next)
  saveSettings(db)
}

async function billActions(S, name) {
  const db = await load(S)
  const b = db.settings.bills.find(x => x.name === name)
  if (!b) return
  const st = compute(db.rows, db.settings, new Date()).bills.find(x => x.name === name)
  const opts = st.paid ? ["edit", "delete"] : ["paid from the bank — pick the SMS", "paid in cash", "paid another way, or skip this month", "edit", "delete"]
  const i = await choose(b.name, `${inr(b.amount)} · day ${b.day} · ${st.paid ? "paid this cycle" : "not paid yet this cycle"}`, opts)
  if (i < 0) return
  const op = opts[i]
  if (op === "edit") return editBill(S, name)
  if (op === "delete") {
    const ok = await choose(`delete ${name}?`, "past payments stay in tape.csv.", ["delete"], true)
    if (ok !== 0) return
    db.settings.bills = db.settings.bills.filter(x => x.name !== name)
    return saveSettings(db)
  }
  if (op.startsWith("paid from")) {
    const since = addDays(new Date(), -40)
    const cands = db.rows.filter(r => r.kind === "spend" && r.amount < 0 && r.time >= since).sort((a, c) => c.time - a.time).slice(0, 20)
    if (!cands.length) return tell("nothing to pick", "no recent payments. if it hasn't gone out yet, wait for its SMS.")
    const k = await choose(`which one was ${name}?`, null, cands.map(r => `${dmon(r.time).toLowerCase()} · ${r.what} · ${inr(r.amount)}`))
    if (k < 0) return
    Object.assign(cands[k], { kind: "fixed", bill: name, slot: "BL" })
  } else if (op === "paid in cash") db.rows.push(manualRow("fixed", -b.amount, name, "BL", "cash", name))
  else db.rows.push(manualRow("fixed", 0, `${name} (marked paid)`, "BL", "", name))
  saveRows(db)
}

async function billsScreen(S) {
  const t = new UITable()
  t.showSeparators = true
  const draw = async () => {
    t.removeAllRows()
    const db = await load(S)
    const n = compute(db.rows, db.settings, new Date())
    addRow(t, "fixed bills", `${inr(n.billsLeft)} still to go out before payday`, null, { titleFont: thin(30), height: 70 })
    for (const b of n.bills) {
      const state = b.paid ? `paid ${dmon(b.paidAt).toLowerCase()}` : b.overdue ? `due ${dmon(b.due).toLowerCase()}, not seen yet` : `due ${dmon(b.due).toLowerCase()}`
      addRow(t, b.name, `${inr(b.amount)} · day ${b.day} · ${state}`, async () => { await billActions(S, b.name); await draw() }, { right: b.paid ? "paid" : inr(b.amount), titleFont: Font.regularSystemFont(16) })
    }
    addRow(t, "+ add a bill", "rent, emi, sip, subscriptions…", async () => { await editBill(S, null); await draw() })
    t.reload()
  }
  await draw()
  await t.present(false)
}

async function setBalance(S, id) {
  const db = await load(S)
  const now = new Date()
  const cur = id === "card" ? Math.max(0, -balanceAt(db.rows, "card", now)) : balanceAt(db.rows, id, now)
  const titles = { card: "credit card bill so far", cash: "cash in your wallet" }
  const msg = id === "card" ? "what you'd pay if you cleared all cards today." : id === "cash" ? "count it, then type it." : "what does your bank app say right now?"
  const f = await form(titles[id] || `balance · ${acctLabel(id, db.settings)}`, msg, [{ hint: "₹", num: true, value: Math.round(cur) }], ["save"])
  if (!f) return
  const v = num(f.values[0])
  if (v === null) return
  db.rows.push(anchorRow(id, id === "card" ? -v : v, now, "you"))
  saveRows(db)
}

async function addAccount(S) {
  const db = await load(S)
  const f = await form("+ bank account", "from your bank app: name, last 4 digits of the account number, and the balance now.", [{ hint: "bank (e.g. sbi)" }, { hint: "last 4 digits", num: "int" }, { hint: "balance now ₹", num: true }], ["save"])
  if (!f) return
  const id = f.values[1].replace(/\D/g, "").slice(-4)
  const bal = num(f.values[2])
  if (id.length < 3 || bal === null) return tell("almost", "the last 4 digits and the balance are both needed.")
  const known = db.settings.accounts.find(a => sameBank(a.id, id))
  if (known) known.name = f.values[0].toLowerCase() || known.name
  else db.settings.accounts.push({ id, name: f.values[0].toLowerCase() || "bank" })
  db.rows.push(anchorRow(known ? known.id : id, bal, new Date(), "you"))
  saveSettings(db)
  saveRows(db)
}

async function balancesScreen(S) {
  const t = new UITable()
  t.showSeparators = true
  const draw = async () => {
    t.removeAllRows()
    const db = await load(S)
    const n = compute(db.rows, db.settings, new Date())
    addRow(t, "balances", "tap one to correct it — left. carries on from there", null, { titleFont: thin(30), height: 70 })
    for (const b of n.banks) addRow(t, b.label, b.anchored ? "bank SMS keep this up to date" : "no balance yet — tap to set it", async () => { await setBalance(S, b.id); await draw() }, { right: inr(b.bal) })
    addRow(t, "cash in your wallet", "atm cash comes in, cash spends go out", async () => { await setBalance(S, "cash"); await draw() }, { right: inr(n.cash) })
    addRow(t, "credit card bill so far", "card spends add to it, card payments clear it", async () => { await setBalance(S, "card"); await draw() }, { right: inr(n.cardDue) })
    addRow(t, "+ add a bank account", null, async () => { await addAccount(S); await draw() })
    t.reload()
  }
  await draw()
  await t.present(false)
}

async function settingsScreen(S) {
  const t = new UITable()
  t.showSeparators = true
  const draw = async () => {
    t.removeAllRows()
    const db = await load(S)
    let seen = null
    try { seen = JSON.parse((await readFile(S, "last-seen.json")) || "null") } catch (e) {}
    addRow(t, "settings", `left. v${VERSION}`, null, { titleFont: thin(30), height: 70 })
    addRow(t, "payday", "the day your salary comes in", async () => {
      const f = await form("payday", "which day of the month does your salary come in? (1–31)", [{ hint: "e.g. 28", num: "int", value: db.settings.payday }], ["save"])
      const d = f ? parseInt(f.values[0], 10) : NaN
      if (d >= 1 && d <= 31) { db.settings.payday = d; saveSettings(db) }
      await draw()
    }, { right: db.settings.payday })
    addRow(t, "notifications", "a note after each payment with what's left today", async () => {
      db.settings.notify = !db.settings.notify
      saveSettings(db)
      if (db.settings.notify) await notify("left.", "notifications are on")
      await draw()
    }, { right: db.settings.notify ? "on" : "off" })
    const seenLine = seen ? `${dmon(new Date(seen.at)).toLowerCase()} ${hm(new Date(seen.at))} · ${seen.result}` : "nothing yet — the shortcut hasn't run"
    addRow(t, "last message the shortcut sent", seenLine, async () => {
      await tell("last message", seen ? `when: ${dmon(new Date(seen.at)).toLowerCase()} ${hm(new Date(seen.at))}\narrived as: ${seen.type}, ${seen.chars} characters\nresult: ${seen.result}\n\nleft. doesn't keep the words of messages that aren't bank transactions.` : "the shortcut hasn't run yet. set it up, then wait for any text message.")
    }, { height: 64 })
    const ai = db.settings.aiSeen ? new Date(db.settings.aiSeen) : null
    addRow(t, "AI reader", ai ? `last answered ${dmon(ai).toLowerCase()} ${hm(ai)}` : "not set up yet — the stencil reads everything", null, { height: 60 })
    addRow(t, "your data", "iCloud Drive › Scriptable › left › tape.csv", null, { height: 60 })
    t.reload()
  }
  await draw()
  await t.present(false)
}

async function preview() {
  const opts = [["small", "small", ""], ["medium", "medium", ""], ["medium · tape", "medium", "tape"], ["large", "large", ""], ["lock screen · rectangle", "accessoryRectangular", ""], ["lock screen · circle", "accessoryCircular", ""], ["lock screen · one line", "accessoryInline", ""]]
  const i = await choose("preview a widget", null, opts.map(o => o[0]))
  if (i < 0) return
  const [, fam, param] = opts[i]
  const w = await buildWidget(fam, param)
  if (fam === "small") await w.presentSmall()
  else if (fam === "medium") await w.presentMedium()
  else if (fam === "large") await w.presentLarge()
  else if (fam === "accessoryRectangular") await w.presentAccessoryRectangular()
  else if (fam === "accessoryCircular") await w.presentAccessoryCircular()
  else await w.presentAccessoryInline()
}

async function fixWarning(S, w) {
  if (w.type === "balance") return setBalance(S, w.id)
  if (w.type === "bill") return billActions(S, w.name)
  return recent(S)
}

async function home(S) {
  const t = new UITable()
  t.showSeparators = true
  const draw = async () => {
    t.removeAllRows()
    const db = await load(S)
    const n = compute(db.rows, db.settings, new Date())
    const P = palette()
    addRow(t, "left.", `day ${pad(n.cyc.dayNo)} of ${n.cyc.length} · payday ${dmon(n.cyc.next).toLowerCase()} · last sms ${n.lastSms ? when(n.lastSms, n.now).toLowerCase() : "none yet"}`, null, { titleFont: thin(34), height: 74 })
    const big = new UITableRow()
    big.height = 108
    const c = big.addText(inr(n.today), `${n.today >= 0 ? "left to spend today" : "over today's share"} · share ${inr(n.share)} · spent ${inr(n.spent)}`)
    c.titleFont = thin(60)
    c.titleColor = P.today
    c.subtitleFont = mono(11)
    c.subtitleColor = P.ink3
    t.addRow(big)
    const four = new UITableRow()
    four.height = 64
    for (const [label, v, col] of [["bal", n.bal, P.bal], ["− fixed", n.fixed, P.fixed], ["= free", n.free, P.free]]) {
      const x = four.addText(inr(v), label)
      x.titleFont = mono(15)
      x.subtitleFont = mono(11)
      x.subtitleColor = col
    }
    t.addRow(four)
    for (const w of n.warnings) addRow(t, "● " + w.text, null, async () => { await fixWarning(S, w); await draw() }, { titleColor: P.today, titleFont: Font.regularSystemFont(15), height: 50 })
    gap(t)
    addRow(t, "+ spend", "cash, or a payment with no bank SMS", async () => { await addSpend(S); await draw() })
    addRow(t, "+ money in", "cash you got, a refund, salary in cash", async () => { await addMoney(S); await draw() })
    addRow(t, "paste a bank SMS", "test the reader, or add one it missed", async () => { await pasteSms(S); await draw() })
    gap(t)
    addRow(t, "recent", `everything it caught · ${n.tape.length} so far`, async () => { await recent(S); await draw() })
    addRow(t, "fixed bills", `${n.bills.length} ${n.bills.length === 1 ? "bill" : "bills"} · ${inr(n.billsLeft)} still to go out`, async () => { await billsScreen(S); await draw() })
    addRow(t, "balances", "banks, cash in your wallet, credit card", async () => { await balancesScreen(S); await draw() })
    addRow(t, "settings", "payday, notifications, what the shortcut sent last", async () => { await settingsScreen(S); await draw() })
    addRow(t, "preview widgets", "see them here before you add them", async () => { await preview(); await draw() })
    t.reload()
  }
  await draw()
  await t.present(false)
}

async function app(action) {
  const S = store()
  await dropStalePending(S, new Date())
  const db = await load(S)
  if (!db.settings.setupAt && !(await setup(S))) return
  if (action === "spend") await addSpend(S)
  await home(S)
}

async function main() {
  if (config.runsInWidget) {
    Script.setWidget(await buildWidget(config.widgetFamily, args.widgetParameter))
    return
  }
  let param = args.shortcutParameter
  // the message can arrive as the action's Parameter, or as plain input text flowing into the action
  if ((param === undefined || param === null || param === "") && args.plainTexts && args.plainTexts.length) param = args.plainTexts.join("\n")
  if (!config.runsInApp || (param !== undefined && param !== null && param !== "")) {
    Script.setShortcutOutput(await capture(param))
    return
  }
  await app((args.queryParameters || {}).do)
}

if (typeof __LEFT_TEST__ !== "undefined" && __LEFT_TEST__) {
  __LEFT_TEST__.exports = { parseSms, compute, cycleFor, buildRow, isDup, pairTransfer, slotFor, toCsv, fromCsv, group, inr, compact, balanceAt, anchorRow, readAi, aiTrusted, aiPrompt, MONEY_RE, AI_RULES }
} else {
  await main()
  Script.complete()
}
