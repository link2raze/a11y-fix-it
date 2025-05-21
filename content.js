// content.js

// Function to generate a unique ID for elements
function generateUniqueId() {
  return 'a11y-fix-it-' + Math.random().toString(36).substr(2, 9);
}

// Function to calculate luminosity (for contrast)
function getLuminosity(r, g, b) {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;

  const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Function to calculate contrast ratio
function getContrastRatio(color1, color2) {
  const lum1 = getLuminosity(color1[0], color1[1], color1[2]);
  const lum2 = getLuminosity(color2[0], color2[1], color2[2]);
  const ratio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
  return ratio;
}

// Function to parse a CSS color string (e.g., "rgb(255, 0, 0)", "#FF0000")
function parseColor(colorString) {
  const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/);
  if (rgbaMatch) {
    return [parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3])];
  }
  // Add more parsing for other formats like hex if needed
  return null; // For simplicity, handle only rgba/rgb for now
}


// Main scanning function
function scanAccessibilityIssues() {
  console.log("A11y Fix-It Assistant: Starting scan...");
  const issues = [];
  let a11yIdCounter = 0; // Simple counter for unique IDs if data-a11y-id is not present

  // 1. Check for missing alt text on images
  document.querySelectorAll('img').forEach(img => {
    // Assign a unique ID if not already present
    if (!img.dataset.a11yId) {
        img.dataset.a11yId = generateUniqueId();
    }
    const id = img.dataset.a11yId;

    if (!img.alt || img.alt.trim() === '') {
      issues.push({
        id: id,
        type: "missingAlt",
        element: img.outerHTML.substring(0, 100) + '...', // Provide a snippet
        suggestion: "Add a descriptive `alt` attribute to this image.",
        fixDetails: {
          id: id,
          type: "missingAlt",
          altText: "Image description" // Default suggestion
        }
      });
      img.style.outline = '2px solid red'; // Highlight the element
      img.dataset.a11yHighlightId = id; // Mark for easy removal of highlight
    }
  });

  // 2. Check for insufficient color contrast (simplified for demonstration)
  // This is a basic check and would need a robust library for full WCAG compliance.
  document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, button').forEach(el => {
    if (!el.dataset.a11yId) {
        el.dataset.a11yId = generateUniqueId();
    }
    const id = el.dataset.a11yId;

    const computedStyle = window.getComputedStyle(el);
    const textColor = parseColor(computedStyle.color);
    const bgColor = parseColor(computedStyle.backgroundColor);

    if (textColor && bgColor) {
      const contrastRatio = getContrastRatio(textColor, bgColor);
      const WCAG_AA_MIN_CONTRAST = 4.5; // For normal text

      if (contrastRatio < WCAG_AA_MIN_CONTRAST) {
        // Suggest a darker/lighter color if current is too light/dark for the background
        const suggestedColor = textColor[0] > 127 && textColor[1] > 127 && textColor[2] > 127 ? 'black' : 'white';

        issues.push({
          id: id,
          type: "contrast",
          element: el.outerHTML.substring(0, 100) + '...',
          suggestion: `Insufficient color contrast (${contrastRatio.toFixed(2)}:1). Needs at least ${WCAG_AA_MIN_CONTRAST}:1.`,
          fixDetails: {
            id: id,
            type: "contrast",
            suggestedColor: suggestedColor // Simple suggestion
          }
        });
        el.style.outline = '2px solid orange'; // Highlight the element
        el.dataset.a11yHighlightId = id; // Mark for easy removal of highlight
      }
    }
  });

  console.log("A11y Fix-It Assistant: Scan complete. Found issues:", issues);

  // Send issues back to the popup for display
  chrome.runtime.sendMessage({ action: "displayIssues", issues: issues });
}

// Listen for messages from the background script to start the scan
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScan") {
    scanAccessibilityIssues();
    sendResponse({ status: "Scan initiated in content script" });
  }
});