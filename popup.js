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
                messageDiv.textContent = 'Could not find an active tab. Please navigate to a web page.'; // More user-friendly
            }
        });
    });

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "displayIssues") {
            loadingMessage.style.display = 'none'; // Hide loading message
            if (message.issues.length === 0) {
                issuesList.innerHTML = '<p class="text-success text-center mt-3 no-issues">No accessibility issues found!</p>'; // Bootstrap classes
                messageDiv.textContent = 'Great job, your page is accessible!'; // More positive message
            } else {
                messageDiv.textContent = `Found ${message.issues.length} issues.`;
                message.issues.forEach(issue => {
                    const issueItem = document.createElement('div');
                    issueItem.className = 'issue-item'; // Applying our custom class

                    let content = `
                        <h6 class="text-danger mb-1">${issue.type === "missingAlt" ? "Missing Alt Text" : "Low Color Contrast"}</h6>
                        <small>Element: <code class="element-snippet">${escapeHTML(issue.element)}</code></small>
                        <p class="suggestion mt-2">${issue.suggestion}</p>
                    `;

                    if (issue.type === "missingAlt") {
                        content += `
                            <div class="input-group mb-2">
                                <input type="text" class="form-control fix-input" placeholder="Enter descriptive alt text" id="alt-input-${issue.id}" value="${escapeHTML(issue.fixDetails.altText)}">
                                <button class="btn btn-sm btn-success btn-fix" data-id="${issue.id}" data-type="missingAlt">Apply Alt Text</button>
                            </div>
                        `;
                    } else if (issue.type === "contrast") {
                        content += `
                            <div class="d-grid gap-2">
                                <button class="btn btn-sm btn-success btn-fix" data-id="${issue.id}" data-type="contrast" data-color="${issue.fixDetails.suggestedColor}">Apply Suggested Color (${issue.fixDetails.suggestedColor})</button>
                            </div>
                        `;
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
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length > 0) {
                                const activeTabId = tabs[0].id;
                                chrome.runtime.sendMessage({ action: "applyFix", tabId: activeTabId, fixDetails: fixDetails }, (response) => {
                                    if (response && response.status) {
                                        console.log(response.status);
                                        // Update UI after fix
                                        const fixedItem = event.target.closest('.issue-item');
                                        if (fixedItem) {
                                            fixedItem.classList.add('issue-fixed');
                                            fixedItem.classList.remove('border-danger'); // If we had a border for error
                                            fixedItem.innerHTML += '<p class="text-success mt-2 mb-0">Fixed!</p>'; // Success message
                                            event.target.style.display = 'none'; // Hide the button
                                            if (type === "missingAlt") {
                                                const altInput = document.getElementById(`alt-input-${id}`);
                                                if (altInput) altInput.disabled = true;
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });
                });
            }
        }
    });

    // Helper function to escape HTML for safe display of element snippets
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
});