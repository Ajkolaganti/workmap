
let cfg = { maskSensitive: true };
chrome.storage.sync.get({ maskSensitive: true }, (res) => { cfg = { ...cfg, ...res }; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.maskSensitive) cfg.maskSensitive = changes.maskSensitive.newValue;
});

const MASKED_NAMES = /pass|pwd|secret|token|card|ssn|email|phone/i;

function nowStep(base) {
  return {
    id: (crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)),
    timestamp: Date.now(),
    url: location.href,
    title: document.title,
    ...base
  };
}

function send(step) {
  chrome.runtime.sendMessage({ type: "RECORDER:EVENT", payload: step });
}

function labelFor(el) {
  if (!el || !el.getAttribute) return null;
  const aria = el.getAttribute("aria-label"); if (aria) return aria.trim();
  const alt = el.getAttribute("alt"); if (alt) return alt.trim();
  const name = el.getAttribute("name"); if (name) return name.trim();
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl && (lbl.innerText || lbl.textContent)) return (lbl.innerText || lbl.textContent).trim().replace(/\s+/g, " ");
  }
  if (el.tagName === "BUTTON" || el.tagName === "A") {
    const t = el.innerText || el.textContent;
    if (t) return t.trim().replace(/\s+/g, " ");
  }
  const maybe = el.closest("label,[role='button']");
  if (maybe) {
    const t = maybe.innerText || maybe.textContent;
    if (t) return t.trim().replace(/\s+/g, " ");
  }
  return null;
}

function buildSelector(el) {
  if (!el || el.nodeType !== 1) return "";
  const pref = ["data-testid", "data-test", "data-qa", "id", "name", "role", "aria-label"];
  for (const a of pref) {
    const v = el.getAttribute(a);
    if (v && !looksRandom(v)) return `[${a}="${cssEscape(v)}"]`;
  }
  const path = [];
  let cur = el;
  for (let depth = 0; cur && depth < 5; depth++) {
    let part = cur.tagName.toLowerCase();
    const id = cur.id;
    if (id && !looksRandom(id)) {
      part += `#${cssEscape(id)}`;
      path.unshift(part);
      break;
    }
    const cls = (cur.className || "")
      .toString()
      .split(/\s+/)
      .filter(c => c && !looksRandom(c))
      .slice(0, 2)
      .map(cssEscape);
    if (cls.length) part += "." + cls.join(".");
    const nth = nthOfType(cur);
    part += `:nth-of-type(${nth})`;
    path.unshift(part);
    cur = cur.parentElement;
  }
  return path.join(" > ");
}

function nthOfType(el) { let i = 1; for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) { if (sib.tagName === el.tagName) i++; } return i; }
function looksRandom(str) { return /[A-Za-z0-9]{6,}/.test(str) && /[0-9]/.test(str) && /[A-Za-z]/.test(str); }
function cssEscape(s) { return CSS.escape(s); }

function onClick(e) {
  const el = e.target && e.target.closest && e.target.closest("button,a,[role='button'],input,select,textarea,[onclick]");
  if (!el) return;
  send(nowStep({ action: "click", selector: buildSelector(el), label: labelFor(el) }));
}

function onChange(e) {
  const el = e.target;
  if (!el) return;
  if (el instanceof HTMLSelectElement) {
    send(nowStep({ action: "select", selector: buildSelector(el), label: labelFor(el), value: el.value }));
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const type = (el.type || "").toLowerCase();
    const isSensitive = (type === "password") || MASKED_NAMES.test(el.name || "") || MASKED_NAMES.test(el.id || "");
    const val = (cfg.maskSensitive && isSensitive) ? "" : (el.value ?? "");
    send(nowStep({ action: "input", selector: buildSelector(el), label: labelFor(el), value: val }));
  }
}

function onSubmit(e) {
  const form = e.target;
  send(nowStep({ action: "submit", selector: buildSelector(form), label: form.getAttribute("name") || form.getAttribute("aria-label") || "Form" }));
}

function hookSPA() {
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  function sendNav() { send(nowStep({ action: "navigate" })); }
  history.pushState = function(...args) { const r = origPush.apply(this, args); setTimeout(sendNav, 0); return r; };
  history.replaceState = function(...args) { const r = origReplace.apply(this, args); setTimeout(sendNav, 0); return r; };
  window.addEventListener("popstate", sendNav);
}

window.addEventListener("click", onClick, true);
window.addEventListener("change", onChange, true);
window.addEventListener("submit", onSubmit, true);
hookSPA();
