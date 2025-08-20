
const defaults = { captureScreenshots: true, maskSensitive: true };
function load() {
  chrome.storage.sync.get(defaults, (res) => {
    document.getElementById("captureScreenshots").checked = !!res.captureScreenshots;
    document.getElementById("maskSensitive").checked = !!res.maskSensitive;
  });
}
load();
document.getElementById("save").onclick = () => {
  const captureScreenshots = document.getElementById("captureScreenshots").checked;
  const maskSensitive = document.getElementById("maskSensitive").checked;
  chrome.storage.sync.set({ captureScreenshots, maskSensitive }, () => {
    const el = document.getElementById("status");
    el.textContent = "Saved.";
    setTimeout(() => el.textContent = "", 1500);
  });
};
