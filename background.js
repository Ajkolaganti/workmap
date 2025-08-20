let isRecording = false;
let steps = [];
const defaultSettings = { captureScreenshots: true, maskSensitive: true };
let settings = { ...defaultSettings };

async function updateBadge() {
  if (isRecording) {
    const text = String(steps.length || "");
    try { await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" }); } catch {}
    try { await chrome.action.setBadgeTextColor({ color: "#FFFFFF" }); } catch {}
    await chrome.action.setBadgeText({ text: text === "0" ? "REC" : text.slice(-4) });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(defaultSettings, (res) => {
    chrome.storage.sync.set({ ...defaultSettings, ...res });
    settings = { ...defaultSettings, ...res };
  });
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [k, { newValue }] of Object.entries(changes)) {
    settings[k] = newValue;
  }
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "RECORDER:TOGGLE") {
    isRecording = !isRecording;
    if (!isRecording) steps = steps; // no-op
    await updateBadge();
    sendResponse({ isRecording });
    return true;
  }

  if (msg.type === "RECORDER:CLEAR") {
    steps = [];
    await updateBadge();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "RECORDER:GET_STEPS") {
    sendResponse({ steps, isRecording });
    return true;
  }

  if (msg.type === "RECORDER:EVENT") {
    if (!isRecording) return;
    const step = msg.payload || {};
    if (settings.captureScreenshots && (step.action === "click" || step.action === "submit")) {
      try {
        const image = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
        step.screenshotDataUrl = image;
      } catch (e) {}
    }
    steps.push(step);
    // Notify any open UI and update badge
    try {
      chrome.runtime.sendMessage({ type: "RECORDER:STEP_RECORDED", step, count: steps.length });
    } catch (e) {
      // Ignore connection errors - no popup is open
    }
    await updateBadge();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "RECORDER:EXPORT_MD") {
    const md = stepsToMarkdown(steps);
    sendResponse({ md });
    return true;
  }

  if (msg.type === "RECORDER:EXPORT_JSON") {
    try { sendResponse({ json: JSON.stringify(steps, null, 2) }); }
    catch { sendResponse({ json: "[]"}); }
    return true;
  }

  if (msg.type === "RECORDER:EXPORT_DOC") {
    const html = stepsToDocHtml(steps);
    sendResponse({ html });
    return true;
  }

  if (msg.type === "RECORDER:EXPORT_PDF") {
    const html = stepsToPdfHtml(steps);
    sendResponse({ html });
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-recording") {
    isRecording = !isRecording;
    await updateBadge();
    try {
      chrome.runtime.sendMessage({ type: "RECORDER:STATE", isRecording });
    } catch (e) {
      // Ignore connection errors - no popup is open
    }
  }
});

function stepsToMarkdown(steps) {
  const lines = [];
  lines.push(`# WorkMap Workflow Recording`);
  if (!steps.length) { lines.push(`\n_No steps recorded yet._`); return lines.join("\n"); }
  
  const now = new Date().toLocaleString();
  lines.push(`\n**Generated:** ${now}`);
  lines.push(`**Total Steps:** ${steps.length}`);
  lines.push(`\n---\n`);
  
  let i = 1;
  for (const s of steps) {
    const time = new Date(s.timestamp || Date.now()).toLocaleString();
    lines.push(`## Step ${i} — ${escapeMd(s.action || "")}`);
    lines.push(`**Time:** ${time}`);
    lines.push(`**Page:** ${escapeMd(s.title || "")}`);
    lines.push(`**URL:** ${escapeMd(s.url || "")}`);
    if (s.label) lines.push(`**Target:** ${escapeMd(s.label)}`);
    if (s.value) lines.push(`**Value:** \`${escapeMd(s.value)}\``);
    if (s.selector) lines.push(`**Selector:** \`${escapeMd(s.selector)}\``);
    if (s.screenshotDataUrl) lines.push(`**Screenshot:** Captured`);
    lines.push(`\n---\n`);
    i++;
  }
  return lines.join("\n");
}

function escapeMd(str) { return String(str).replace(/([*_`~])/g, "\\$1"); }

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stepsToDocHtml(steps) {
  const head = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>WorkMap Workflow Recording</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; margin: 20px; }
      header { background: linear-gradient(135deg, #6366f1, #06d6a0); color: #fff; padding: 16px 18px; border-radius: 12px; }
      h1 { font-size: 22pt; margin: 0; }
      h2 { font-size: 16pt; margin: 18px 0 6px; }
      .meta { color: #444; font-size: 10pt; margin: 2px 0; }
      img { max-width: 700px; height: auto; border: 1px solid #ddd; border-radius: 6px; }
      .step { page-break-inside: avoid; margin: 14px 0 18px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
      .code { font-family: Consolas, monospace; background: #f6f6f6; padding: 2px 4px; border-radius: 3px; }
    </style>
  </head>
  <body>
    <header><h1>WorkMap Workflow Recording</h1></header>
  `;
  const body = steps.map((s, i) => {
    const dt = new Date(s.timestamp || Date.now()).toLocaleString();
    return `
    <div class="step">
      <h2>Step ${i+1}: ${escHtml(s.action || "")}${s.label ? (' — ' + escHtml(s.label)) : ""}</h2>
      <div class="meta"><b>Page:</b> ${escHtml(s.title || "")}</div>
      <div class="meta"><b>URL:</b> ${escHtml(s.url || "")}</div>
      ${s.selector ? `<div class="meta"><b>Selector:</b> <span class="code">${escHtml(s.selector)}</span></div>` : ""}
      ${s.value ? `<div class="meta"><b>Value:</b> <span class="code">${escHtml(s.value)}</span></div>` : ""}
      <div class="meta"><b>Time:</b> ${escHtml(dt)}</div>
      ${s.screenshotDataUrl ? `<div><img src="${s.screenshotDataUrl}" /></div>` : ""}
    </div>`;
  }).join("\n");
  const tail = `</body></html>`;
  return head + body + tail;
}

function stepsToPdfHtml(steps) {
  const now = new Date().toLocaleString();
  const head = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>WorkMap Workflow Recording</title>
    <style>
      @page {
        margin: 20mm;
        size: A4;
      }
      
      * {
        box-sizing: border-box;
      }
      
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #2d3748;
        margin: 0;
        padding: 0;
        background: white;
      }
      
      .header {
        background: linear-gradient(135deg, #6366f1, #06d6a0);
        color: white;
        padding: 30px;
        border-radius: 12px;
        margin-bottom: 30px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2);
      }
      
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }
      
      .header .subtitle {
        margin: 8px 0 0 0;
        font-size: 16px;
        opacity: 0.9;
        font-weight: 400;
      }
      
      .summary {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 30px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 20px;
      }
      
      .summary-item {
        text-align: center;
      }
      
      .summary-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        margin-bottom: 4px;
      }
      
      .summary-value {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
      }
      
      .step {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        page-break-inside: avoid;
        position: relative;
      }
      
      .step::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: linear-gradient(180deg, #6366f1, #06d6a0);
        border-radius: 0 2px 2px 0;
      }
      
      .step-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-left: 16px;
      }
      
      .step-number {
        background: linear-gradient(135deg, #6366f1, #06d6a0);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        flex-shrink: 0;
      }
      
      .step-title {
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
      }
      
      .step-content {
        padding-left: 16px;
      }
      
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      
      .meta-item {
        background: #f8fafc;
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid #6366f1;
      }
      
      .meta-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        margin-bottom: 4px;
      }
      
      .meta-value {
        font-size: 13px;
        color: #1e293b;
        word-break: break-all;
      }
      
      .meta-code {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        background: #1e293b;
        color: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .screenshot {
        margin-top: 16px;
        text-align: center;
      }
      
      .screenshot img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
      }
      
      .footer {
        text-align: center;
        padding: 20px;
        color: #64748b;
        font-size: 12px;
        border-top: 1px solid #e2e8f0;
        margin-top: 40px;
      }
      
      @media print {
        body { print-color-adjust: exact; }
        .step { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>WorkMap Workflow Recording</h1>
      <div class="subtitle">Automated Step-by-Step Documentation</div>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Generated</div>
        <div class="summary-value">${escHtml(now)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Steps</div>
        <div class="summary-value">${steps.length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Duration</div>
        <div class="summary-value">${steps.length ? Math.round((steps[steps.length-1].timestamp - steps[0].timestamp) / 60000) + 'm' : '0m'}</div>
      </div>
    </div>
  `;
  
  const body = steps.map((s, i) => {
    const dt = new Date(s.timestamp || Date.now()).toLocaleString();
    return `
    <div class="step">
      <div class="step-header">
        <div class="step-number">${i+1}</div>
        <h2 class="step-title">${escHtml(s.action || "Unknown Action")}${s.label ? ' — ' + escHtml(s.label) : ""}</h2>
      </div>
      <div class="step-content">
        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Page Title</div>
            <div class="meta-value">${escHtml(s.title || "Unknown Page")}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Timestamp</div>
            <div class="meta-value">${escHtml(dt)}</div>
          </div>
          ${s.url ? `
          <div class="meta-item" style="grid-column: span 2;">
            <div class="meta-label">URL</div>
            <div class="meta-value">${escHtml(s.url)}</div>
          </div>
          ` : ''}
          ${s.selector ? `
          <div class="meta-item" style="grid-column: span 2;">
            <div class="meta-label">Element Selector</div>
            <div class="meta-value"><span class="meta-code">${escHtml(s.selector)}</span></div>
          </div>
          ` : ''}
          ${s.value ? `
          <div class="meta-item" style="grid-column: span 2;">
            <div class="meta-label">Input Value</div>
            <div class="meta-value"><span class="meta-code">${escHtml(s.value)}</span></div>
          </div>
          ` : ''}
        </div>
        ${s.screenshotDataUrl ? `
        <div class="screenshot">
          <img src="${s.screenshotDataUrl}" alt="Screenshot of step ${i+1}" />
        </div>
        ` : ''}
      </div>
    </div>`;
  }).join("\n");
  
  const tail = `
    <div class="footer">
      Generated by WorkMap • Visual Workflow Recording
    </div>
  </body></html>`;
  
  return head + body + tail;
}