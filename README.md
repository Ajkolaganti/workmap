# Step Recorder (Any Site) – Chrome Extension

Record step-by-step user actions on **any website** and export them into **Markdown, JSON, Word (.doc)** (with screenshots).  
Useful for documenting processes, creating tutorials, or reproducing bugs.

---

## ✨ Features
- Works on **any website** (except restricted Chrome pages and the Chrome Web Store).
- Records:
  - Clicks
  - Inputs (with optional sensitive-field masking)
  - Selects
  - Form submits
  - SPA navigation (history API)
- **Screenshots** for clicks & submits (optional).
- Export options:
  - 📄 Markdown (`.md`)
  - 🗂 JSON (`.json`)
  - 📝 Word-compatible (`.doc`)
- Modern UI:
  - Gradient header & card layout
  - Recording indicator (pulsing dot + badge count)
  - "Step recorded" toast notifications
- Options page for toggling **screenshots** and **masking sensitive fields**.

---

## 🚀 Installation

### Developer Mode (Unpacked)
1. Clone or download this repository.
2. Open Chrome and go to:  
   `chrome://extensions/`
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. Pin the extension to your toolbar.

### Usage
- Click **Start Recording** or press `Ctrl + Shift + R` to toggle recording.
- Perform actions in the browser – each step is captured automatically.
- Use the popup to:
  - Copy or download steps as Markdown/JSON
  - Download a Word (.doc) file with embedded screenshots
- Stop recording anytime. The toolbar badge shows step count when active.

---

## 🛠 Options
Open the **Options** page to:
- ✅ Enable/disable screenshot capture
- ✅ Enable/disable masking of sensitive fields (passwords, tokens, emails, phone numbers)

---

## 📷 Screenshots
(Add some screenshots of popup UI, options page, and exported document here.)

---

## 📜 Roadmap
- [ ] Add **PDF export** for better screenshot formatting
- [ ] Add **.docx native export**
- [ ] Option to **pause recording**
- [ ] Cloud sync (push to Confluence, Jira, Azure DevOps Wiki)

---

## 📄 License
[MIT](LICENSE)

---

## 🙌 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change.

---

## 💡 Use Cases
- Create **step-by-step tutorials** for colleagues.
- Log **bug reproduction steps** with screenshots.
- Auto-generate **SOPs** (Standard Operating Procedures).
- Document **DevOps workflows** in Azure/other tools.

---
