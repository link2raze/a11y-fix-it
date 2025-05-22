// Enhanced background.js (Service Worker) with better error handling

class A11yBackgroundService {
    constructor() {
        this.activeScans = new Set();
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Handle async operations properly
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case "scanAccessibility":
                    await this.handleScanRequest(message, sendResponse);
                    break;
                case "applyFix":
                    await this.handleFixRequest(message, sendResponse);
                    break;
                default:
                    sendResponse({ status: "Unknown action", error: true });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ status: `Error: ${error.message}`, error: true });
        }
    }

    async handleScanRequest(message, sendResponse) {
        const tabId = message.tabId;
        
        if (!tabId) {
            console.error("No tabId received for scanAccessibility.");
            sendResponse({ status: "Error: No active tab ID.", error: true });
            return;
        }

        // Prevent multiple scans on the same tab
        if (this.activeScans.has(tabId)) {
            sendResponse({ status: "Scan already in progress for this tab", error: true });
            return;
        }

        try {
            this.activeScans.add(tabId);

            // Check if tab exists and is accessible
            const tab = await this.getTab(tabId);
            if (!tab) {
                throw new Error("Tab not found or not accessible");
            }

            // Check if we can access the tab (not a chrome:// or extension page)
            if (!this.isTabAccessible(tab.url)) {
                throw new Error("Cannot access this type of page (chrome://, extension pages, etc.)");
            }

            // Inject content script with error handling
            await this.injectContentScript(tabId);
            
            // Send message to start scan
            await this.sendMessageToTab(tabId, { action: "startScan" });
            
            sendResponse({ status: "Scan initiated successfully" });

        } catch (error) {
            console.error('Error during scan request:', error);
            sendResponse({ 
                status: `Error: ${error.message}`, 
                error: true 
            });
        } finally {
            // Remove from active scans after a timeout
            setTimeout(() => {
                this.activeScans.delete(tabId);
            }, 30000); // 30 second timeout
        }
    }

    async handleFixRequest(message, sendResponse) {
        const tabId = message.tabId;
        const fixDetails = message.fixDetails;

        if (!tabId) {
            console.error("No tabId received for applyFix.");
            sendResponse({ status: "Error: No active tab ID.", error: true });
            return;
        }

        if (!fixDetails) {
            console.error("No fix details received.");
            sendResponse({ status: "Error: No fix details provided.", error: true });
            return;
        }

        try {
            // Check if tab exists and is accessible
            const tab = await this.getTab(tabId);
            if (!tab) {
                throw new Error("Tab not found or not accessible");
            }

            // Apply the fix using executeScript for better error handling
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: this.applyFixOnPage,
                args: [fixDetails]
            });

            if (results && results[0] && results[0].result) {
                sendResponse({ status: "Fix applied successfully" });
            } else {
                throw new Error("Fix application failed");
            }

        } catch (error) {
            console.error('Error during fix request:', error);
            sendResponse({ 
                status: `Error applying fix: ${error.message}`, 
                error: true 
            });
        }
    }

    async getTab(tabId) {
        try {
            return await chrome.tabs.get(tabId);
        } catch (error) {
            console.error('Error getting tab:', error);
            return null;
        }
    }

    isTabAccessible(url) {
        if (!url) return false;
        
        const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
        return !restrictedProtocols.some(protocol => url.startsWith(protocol));
    }

    async injectContentScript(tabId) {
        try {
            // Check if content script is already injected
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => typeof window.a11yScanner !== 'undefined'
            });

            const isInjected = results && results[0] && results[0].result;
            
            if (!isInjected) {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["content.js"]
                });
                
                // Small delay to ensure script is loaded
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            throw new Error(`Failed to inject content script: ${error.message}`);
        }
    }

    async sendMessageToTab(tabId, message) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            throw new Error(`Failed to send message to tab: ${error.message}`);
        }
    }

    // Enhanced fix application function that runs in the page context
    applyFixOnPage(fixDetails) {
        try {
            console.log('Applying fix:', fixDetails);
            
            const element = document.querySelector(`[data-a11y-id="${fixDetails.id}"]`);
            if (!element) {
                console.error('Element not found for fix:', fixDetails.id);
                return { success: false, error: 'Element not found' };
            }

            let success = false;
            let message = '';

            switch (fixDetails.type) {
                case "missingAlt":
                case "poorAlt":
                    success = this.applyAltTextFix(element, fixDetails);
                    message = `Added alt text: "${fixDetails.altText}"`;
                    break;
                    
                case "contrast":
                    success = this.applyContrastFix(element, fixDetails);
                    message = `Changed color to: ${fixDetails.suggestedColor}`;
                    break;
                    
                case "missingLabel":
                    success = this.applyLabelFix(element, fixDetails);
                    message = 'Added accessible label';
                    break;
                    
                default:
                    console.error('Unknown fix type:', fixDetails.type);
                    return { success: false, error: 'Unknown fix type' };
            }

            if (success) {
                // Remove highlight after successful fix
                this.removeHighlight(element, fixDetails.id);
                
                // Show success notification
                this.showNotification(message, 'success');
                
                console.log(`A11y Fix applied successfully: ${message}`);
                return { success: true, message: message };
            } else {
                return { success: false, error: 'Fix application failed' };
            }

        } catch (error) {
            console.error('Error in applyFixOnPage:', error);
            return { success: false, error: error.message };
        }
    }

    applyAltTextFix(element, fixDetails) {
        const tagName = element.tagName.toLowerCase();
        
        try {
            if (tagName === 'img') {
                element.setAttribute('alt', fixDetails.altText);
            } else if (tagName === 'svg') {
                element.setAttribute('aria-label', fixDetails.altText);
            } else if (tagName === 'canvas') {
                element.setAttribute('aria-label', fixDetails.altText);
            } else if (element.getAttribute('role') === 'img') {
                element.setAttribute('aria-label', fixDetails.altText);
            }
            return true;
        } catch (error) {
            console.error('Error applying alt text fix:', error);
            return false;
        }
    }

    applyContrastFix(element, fixDetails) {
        try {
            element.style.color = fixDetails.suggestedColor;
            return true;
        } catch (error) {
            console.error('Error applying contrast fix:', error);
            return false;
        }
    }

    applyLabelFix(element, fixDetails) {
        try {
            const labelText = `Accessible label for ${element.type || element.tagName.toLowerCase()}`;
            element.setAttribute('aria-label', labelText);
            return true;
        } catch (error) {
            console.error('Error applying label fix:', error);
            return false;
        }
    }

    removeHighlight(element, id) {
        try {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.style.animation = '';
            if (element.dataset.a11yHighlightId) {
                delete element.dataset.a11yHighlightId;
            }
        } catch (error) {
            console.error('Error removing highlight:', error);
        }
    }

    showNotification(message, type = 'success') {
        try {
            // Create a temporary notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#10b981' : '#ef4444'};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                font-weight: 500;
                max-width: 300px;
                transform: translateX(400px);
                transition: transform 0.3s ease;
            `;
            notification.textContent = `A11y Fix: ${message}`;
            
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
            
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
}

// Initialize the background service
const a11yBackgroundService = new A11yBackgroundService();

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
    console.log('A11y Fix-It Assistant installed/updated:', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('A11y Fix-It Assistant started');
});

// Handle tab updates to clean up any active scans
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        // Clear any active scans for this tab when it starts loading a new page
        a11yBackgroundService.activeScans.delete(tabId);
    }
});