const toggleBtn = document.getElementById("toggle");
const countSpan = document.getElementById("count");
const recText = document.getElementById("recText");
const recState = document.getElementById("recState");
const recDot = document.getElementById("recDot");
const lastDiv = document.getElementById("last");
const toast = document.getElementById("toast");

function setRecordingUI(isRecording) {
  recState.textContent = isRecording ? "Recording" : "Idle";
  recDot.classList.toggle("red", !!isRecording);
  toggleBtn.textContent = isRecording ? "Stop Recording" : "Start Recording";
}

async function getState() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "RECORDER:GET_STEPS" });
    if (!res) {
      console.error('No response from background script');
      countSpan.textContent = '0';
      setRecordingUI(false);
      lastDiv.style.display = 'none';
      return;
    }
    countSpan.textContent = (res.steps || []).length;
    setRecordingUI(res.isRecording || false);
    
    if (res.steps && res.steps.length) {
      const s = res.steps[res.steps.length-1];
      const actionIcon = getActionIcon(s.action);
      lastDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">${actionIcon}</span>
          <div>
            <div style="font-weight: 500; color: var(--text-secondary);">
              ${escapeHtml(s.action || "Unknown")}${s.label ? " — " + escapeHtml(s.label) : ""}
            </div>
            <div style="font-size: 11px; opacity: 0.7;">
              ${escapeHtml(s.title || "Unknown Page")}
            </div>
          </div>
        </div>
      `;
      lastDiv.style.display = 'block';
    } else {
      lastDiv.style.display = 'none';
    }
  } catch (error) {
    console.error('Error getting state:', error);
    countSpan.textContent = '0';
    setRecordingUI(false);
    lastDiv.style.display = 'none';
  }
}

function getActionIcon(action) {
  const icons = {
    'click': '👆',
    'input': '✏️',
    'select': '📋',
    'submit': '📤',
    'navigate': '🔗',
    'scroll': '📜'
  };
  return icons[action] || '🔘';
}

toggleBtn.onclick = async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: "RECORDER:TOGGLE" });
    if (res) {
      setRecordingUI(res.isRecording || false);
    }
    getState();
  } catch (error) {
    console.error('Error toggling recording:', error);
    showToast('Error: Could not toggle recording');
  }
};

// PDF Generation Function
async function generateAndDownloadPDF(html) {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary window for PDF generation
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      
      if (!printWindow) {
        throw new Error('Could not open print window. Please allow popups for this extension.');
      }

      // Write the HTML content to the new window
      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          // Configure print settings for PDF
          printWindow.print();
          
          // Close the window after a short delay
          setTimeout(() => {
            printWindow.close();
            resolve();
          }, 1000);
        }, 500);
      };

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
            resolve();
          }, 1000);
        }
      }, 2000);

    } catch (error) {
      reject(error);
    }
  });
}

// PDF Export Functions
document.getElementById("exportPdf").onclick = async () => {
  try {
    const { html } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_PDF" });
    await navigator.clipboard.writeText(html || "");
    showToast("PDF HTML copied to clipboard");
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showToast('Error exporting PDF');
  }
};

document.getElementById("downloadPdf").onclick = async () => {
  try {
    const { html } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_PDF" });
    if (html) {
      // Generate and download actual PDF
      await generateAndDownloadPDF(html);
      showToast("PDF generated and downloaded");
    } else {
      showToast("No steps to export");
    }
  } catch (error) {
    console.error('Error downloading PDF:', error);
    showToast('Error downloading PDF');
  }
};

// Existing export functions
document.getElementById("exportMd").onclick = async () => {
  try {
    const { md } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_MD" });
    await navigator.clipboard.writeText(md || "");
    showToast("Markdown copied");
  } catch (error) {
    console.error('Error exporting markdown:', error);
    showToast('Error exporting markdown');
  }
};

document.getElementById("downloadMd").onclick = async () => {
  try {
    const { md } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_MD" });
    downloadBlob(new Blob([md || ""], { type: "text/markdown;charset=utf-8" }), "workmap-workflow.md");
    showToast("Markdown downloaded");
  } catch (error) {
    console.error('Error downloading markdown:', error);
    showToast('Error downloading markdown');
  }
};

document.getElementById("exportJson").onclick = async () => {
  try {
    const { json } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_JSON" });
    await navigator.clipboard.writeText(json || "[]");
    showToast("JSON copied");
  } catch (error) {
    console.error('Error exporting JSON:', error);
    showToast('Error exporting JSON');
  }
};

document.getElementById("downloadJson").onclick = async () => {
  try {
    const { json } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_JSON" });
    downloadBlob(new Blob([json || "[]"], { type: "application/json;charset=utf-8" }), "workmap-workflow.json");
    showToast("JSON downloaded");
  } catch (error) {
    console.error('Error downloading JSON:', error);
    showToast('Error downloading JSON');
  }
};

document.getElementById("downloadDoc").onclick = async () => {
  try {
    const { html } = await chrome.runtime.sendMessage({ type: "RECORDER:EXPORT_DOC" });
    downloadBlob(new Blob([html || "<html><body><p>No steps.</p></body></html>"], { type: "application/msword" }), "workmap-workflow.doc");
    showToast("Word document downloaded");
  } catch (error) {
    console.error('Error downloading Word document:', error);
    showToast('Error downloading Word document');
  }
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RECORDER:STEP_RECORDED") {
    countSpan.textContent = msg.count || '0';
    const s = msg.step || {};
    const actionIcon = getActionIcon(s.action);
    lastDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${actionIcon}</span>
        <div>
          <div style="font-weight: 500; color: var(--text-secondary);">
            ${escapeHtml(s.action || "Unknown")}${s.label ? " — " + escapeHtml(s.label) : ""}
          </div>
          <div style="font-size: 11px; opacity: 0.7;">
            ${escapeHtml(s.title || "Unknown Page")}
          </div>
        </div>
      </div>
    `;
    lastDiv.style.display = 'block';
    showToast(`Step ${msg.count} recorded`);
  }
  if (msg.type === "RECORDER:STATE") {
    setRecordingUI(msg.isRecording || false);
    getState();
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; 
  a.download = filename; 
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function escapeHtml(s) { 
  return String(s||"").replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); 
}

// Initialize
getState();