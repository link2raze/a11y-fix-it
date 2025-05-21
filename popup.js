// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const issuesList = document.getElementById('issuesList');
    const messageDiv = document.getElementById('message');
    const loadingMessage = document.getElementById('loadingMessage');

    scanButton.addEventListener('click', () => {
        issuesList.innerHTML = ''; // Clear previous issues
        messageDiv.textContent = ''; // Clear previous messages
        loadingMessage.style.display = 'block'; // Show loading message

        // --- NEW CODE HERE ---
        // Get the currently active tab and its ID
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const activeTabId = tabs[0].id;
                // Send a message to the background script to start the scan, passing the tabId
                chrome.runtime.sendMessage({ action: "scanAccessibility", tabId: activeTabId }, (response) => {
                    if (response && response.status) {
                        console.log(response.status);
                    }
                });
            } else {
                loadingMessage.style.display = 'none';
                messageDiv.textContent = 'Could not find an active tab.';
            }
        });
        // --- END NEW CODE ---
    });

    // ... (rest of popup.js remains the same) ...

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "displayIssues") {
            loadingMessage.style.display = 'none'; // Hide loading message
            if (message.issues.length === 0) {
                issuesList.innerHTML = '<p style="text-align: center; color: green;">No accessibility issues found!</p>';
                messageDiv.textContent = 'Great job!';
            } else {
                messageDiv.textContent = `Found ${message.issues.length} issues.`;
                message.issues.forEach(issue => {
                    const issueItem = document.createElement('div');
                    issueItem.className = 'issue-item';

                    let content = `<strong>${issue.type === "missingAlt" ? "Missing Alt Text" : "Low Contrast"}</strong><br>`;
                    content += `Element: <code>${issue.element}</code><br>`;
                    content += `<span class="suggestion">${issue.suggestion}</span><br>`;

                    if (issue.type === "missingAlt") {
                        content += `<input type="text" placeholder="Enter alt text" id="alt-input-${issue.id}" value="${issue.fixDetails.altText}">`;
                        content += `<button class="fix-button" data-id="${issue.id}" data-type="missingAlt">Apply Alt Text</button>`;
                    } else if (issue.type === "contrast") {
                        content += `<button class="fix-button" data-id="${issue.id}" data-type="contrast" data-color="${issue.fixDetails.suggestedColor}">Apply Suggested Color (${issue.fixDetails.suggestedColor})</button>`;
                        // You could add a color picker or more complex input here
                    }

                    issueItem.innerHTML = content;
                    issuesList.appendChild(issueItem);
                });

                // Attach event listeners to newly created fix buttons
                issuesList.querySelectorAll('.fix-button').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const id = event.target.dataset.id;
                        const type = event.target.dataset.type;
                        let fixDetails = { id: id, type: type };

                        if (type === "missingAlt") {
                            const altInput = document.getElementById(`alt-input-${id}`);
                            fixDetails.altText = altInput ? altInput.value : "Accessible Image";
                        } else if (type === "contrast") {
                            fixDetails.suggestedColor = event.target.dataset.color;
                        }

                        // Send message to background script to apply the fix
                        // --- NEW CODE HERE (for applyFix as well) ---
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length > 0) {
                                const activeTabId = tabs[0].id;
                                chrome.runtime.sendMessage({ action: "applyFix", tabId: activeTabId, fixDetails: fixDetails }, (response) => {
                                    if (response && response.status) {
                                        console.log(response.status);
                                        // Optional: Remove the fixed item from the list or update its status
                                        event.target.closest('.issue-item').style.backgroundColor = '#d4edda'; // Light green for fixed
                                        event.target.closest('.issue-item').style.border = '1px solid #28a745';
                                        event.target.textContent = 'Fixed!';
                                        event.target.disabled = true;
                                        if (type === "missingAlt") {
                                          const altInput = document.getElementById(`alt-input-${id}`);
                                          if(altInput) altInput.disabled = true;
                                        }
                                    }
                                });
                            }
                        });
                        // --- END NEW CODE ---
                    });
                });
            }
        }
    });
});