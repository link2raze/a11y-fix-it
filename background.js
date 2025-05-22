// background.js (Service Worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scanAccessibility") {
    // Use the tabId passed from the popup
    const tabIdToScan = message.tabId;
    if (!tabIdToScan) {
      console.error("No tabId received for scanAccessibility.");
      sendResponse({ status: "Error: No active tab ID." });
      return;
    }

    // Inject content.js into the specified tab
    chrome.scripting.executeScript({
      target: { tabId: tabIdToScan },
      files: ["content.js"]
    }, () => {
      // Once content.js is injected, send a message to it to start the scan
      chrome.tabs.sendMessage(tabIdToScan, { action: "startScan" });
    });
    sendResponse({ status: "Scan initiated" });
  } else if (message.action === "applyFix") {
    // Use the tabId passed from the popup
    const tabIdToApplyFix = message.tabId;
    if (!tabIdToApplyFix) {
      console.error("No tabId received for applyFix.");
      sendResponse({ status: "Error: No active tab ID." });
      return;
    }

    // Forward the applyFix message to the content script in the specified tab
    chrome.scripting.executeScript({
      target: { tabId: tabIdToApplyFix },
      function: applyFixOnPage,
      args: [message.fixDetails]
    });
    sendResponse({ status: "Fix applied" });
  }
});

// This function will be injected and executed in the content script's context
function applyFixOnPage(fixDetails) {
  if (fixDetails.type === "missingAlt") {
    const element = document.querySelector(`[data-a11y-id="${fixDetails.id}"]`);
    if (element) {
      element.setAttribute("alt", fixDetails.altText);
      console.log(`A11y Fix: Added alt="${fixDetails.altText}" to element with ID:`, fixDetails.id, element);
      alert(`Fix applied! Added alt="${fixDetails.altText}" to an image.`);
    }
  } else if (fixDetails.type === "contrast") {
    const element = document.querySelector(`[data-a11y-id="${fixDetails.id}"]`);
    if (element) {
      element.style.color = fixDetails.suggestedColor;
      // You might also want to adjust background if needed
      console.log(`A11y Fix: Changed color to ${fixDetails.suggestedColor} for element with ID:`, fixDetails.id, element);
      alert(`Fix applied! Changed color to ${fixDetails.suggestedColor} for a text element.`);
    }
  }
  // Remove highlight after fix (optional, but good UX)
  const highlightedElement = document.querySelector(`[data-a11y-highlight-id="${fixDetails.id}"]`);
  if (highlightedElement) {
    highlightedElement.style.outline = '';
  }
}