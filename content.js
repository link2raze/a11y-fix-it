// Enhanced content.js with better error handling and performance

class A11yScanner {
    constructor() {
        this.issues = [];
        this.processedElements = new Set();
        this.observer = null;
        this.isScanning = false;
    }

    // Generate a more robust unique ID
    generateUniqueId() {
        return 'a11y-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Enhanced luminosity calculation
    getLuminosity(r, g, b) {
        const rs = r / 255;
        const gs = g / 255;
        const bs = b / 255;

        const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
        const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
        const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    // Enhanced contrast ratio calculation
    getContrastRatio(color1, color2) {
        if (!color1 || !color2) return null;
        
        const lum1 = this.getLuminosity(color1[0], color1[1], color1[2]);
        const lum2 = this.getLuminosity(color2[0], color2[1], color2[2]);
        const ratio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
        return ratio;
    }

    // Enhanced color parsing with support for multiple formats
    parseColor(colorString) {
        if (!colorString || colorString === 'transparent' || colorString === 'rgba(0, 0, 0, 0)') {
            return null;
        }

        // RGB/RGBA format
        const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/);
        if (rgbaMatch) {
            const alpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
            if (alpha < 0.1) return null; // Too transparent
            return [parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3])];
        }

        // Hex format
        const hexMatch = colorString.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (hexMatch) {
            return [
                parseInt(hexMatch[1], 16),
                parseInt(hexMatch[2], 16),
                parseInt(hexMatch[3], 16)
            ];
        }

        // Named colors (basic support)
        const namedColors = {
            'black': [0, 0, 0],
            'white': [255, 255, 255],
            'red': [255, 0, 0],
            'green': [0, 128, 0],
            'blue': [0, 0, 255],
            'gray': [128, 128, 128],
            'grey': [128, 128, 128]
        };

        return namedColors[colorString.toLowerCase()] || null;
    }

    // Get effective background color by traversing up the DOM
    getEffectiveBackgroundColor(element) {
        let current = element;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const bgColor = this.parseColor(style.backgroundColor);
            if (bgColor) {
                return bgColor;
            }
            current = current.parentElement;
        }
        return [255, 255, 255]; // Default to white
    }

    // Check if element is visible
    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );
    }

    // Enhanced alt text suggestions based on context
    generateAltTextSuggestion(img) {
        // Check for nearby text that might describe the image
        const parent = img.parentElement;
        const siblings = parent ? Array.from(parent.children) : [];
        
        // Look for figcaption
        const figcaption = siblings.find(el => el.tagName.toLowerCase() === 'figcaption');
        if (figcaption && figcaption.textContent.trim()) {
            return figcaption.textContent.trim();
        }

        // Look for title attribute
        if (img.title && img.title.trim()) {
            return img.title.trim();
        }

        // Look for data attributes that might contain description
        if (img.dataset.description) {
            return img.dataset.description;
        }

        // Check image file name for clues
        const src = img.src || img.getAttribute('src') || '';
        const filename = src.split('/').pop()?.split('.')[0] || '';
        if (filename && !filename.match(/^\d+$/) && filename.length > 2) {
            return filename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        // Default suggestions based on context
        const imgClasses = img.className.toLowerCase();
        if (imgClasses.includes('logo')) return 'Company logo';
        if (imgClasses.includes('avatar') || imgClasses.includes('profile')) return 'Profile picture';
        if (imgClasses.includes('icon')) return 'Icon';
        if (imgClasses.includes('banner') || imgClasses.includes('hero')) return 'Banner image';
        
        return 'Descriptive text for image';
    }

    // Enhanced image accessibility check
    checkImageAccessibility() {
        const images = document.querySelectorAll('img, svg, canvas, [role="img"]');
        let imageIssues = [];

        images.forEach(img => {
            if (!this.isElementVisible(img)) return;

            // Assign unique ID if not present
            if (!img.dataset.a11yId) {
                img.dataset.a11yId = this.generateUniqueId();
            }
            const id = img.dataset.a11yId;

            // Skip if already processed
            if (this.processedElements.has(id)) return;
            this.processedElements.add(id);

            let hasAccessibleText = false;
            let issueType = null;
            let suggestion = '';

            // Check different types of elements
            if (img.tagName.toLowerCase() === 'img') {
                // Regular images
                const alt = img.getAttribute('alt');
                if (alt === null || alt.trim() === '') {
                    // Check if image is decorative (has empty alt="" intentionally)
                    if (alt === '') {
                        // This might be intentionally decorative, but let's check context
                        const parent = img.parentElement;
                        const hasTextContent = parent && parent.textContent.trim().length > img.outerHTML.length;
                        if (!hasTextContent) {
                            issueType = 'missingAlt';
                            suggestion = 'This image appears to be informative but lacks alt text. Add descriptive alt text.';
                        }
                    } else {
                        issueType = 'missingAlt';
                        suggestion = 'Image is missing alt attribute. Add descriptive alt text for screen readers.';
                    }
                } else if (alt.length < 3 || alt.toLowerCase().includes('image') || alt.toLowerCase().includes('picture')) {
                    issueType = 'poorAlt';
                    suggestion = 'Alt text could be more descriptive. Avoid words like "image" or "picture".';
                }
            } else if (img.tagName.toLowerCase() === 'svg') {
                // SVG elements
                const ariaLabel = img.getAttribute('aria-label');
                const ariaLabelledby = img.getAttribute('aria-labelledby');
                const title = img.querySelector('title');
                const desc = img.querySelector('desc');
                
                if (!ariaLabel && !ariaLabelledby && !title && !desc) {
                    issueType = 'missingAlt';
                    suggestion = 'SVG lacks accessible text. Add aria-label, title, or desc element.';
                }
            } else if (img.tagName.toLowerCase() === 'canvas') {
                // Canvas elements
                const ariaLabel = img.getAttribute('aria-label');
                const ariaLabelledby = img.getAttribute('aria-labelledby');
                
                if (!ariaLabel && !ariaLabelledby && !img.textContent.trim()) {
                    issueType = 'missingAlt';
                    suggestion = 'Canvas element lacks accessible text. Add aria-label or descriptive text content.';
                }
            } else if (img.getAttribute('role') === 'img') {
                // Elements with img role
                const ariaLabel = img.getAttribute('aria-label');
                const ariaLabelledby = img.getAttribute('aria-labelledby');
                
                if (!ariaLabel && !ariaLabelledby) {
                    issueType = 'missingAlt';
                    suggestion = 'Element with img role lacks accessible text. Add aria-label or aria-labelledby.';
                }
            }

            if (issueType) {
                const altSuggestion = this.generateAltTextSuggestion(img);
                imageIssues.push({
                    id: id,
                    type: issueType,
                    element: this.getElementDescription(img),
                    suggestion: suggestion,
                    fixDetails: {
                        id: id,
                        type: issueType,
                        altText: altSuggestion,
                        elementType: img.tagName.toLowerCase()
                    }
                });

                // Highlight the element
                this.highlightElement(img, id, 'error');
            }
        });

        return imageIssues;
    }

    // Enhanced contrast checking
    checkColorContrast() {
        const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, button, label, td, th, div, section');
        let contrastIssues = [];

        textElements.forEach(el => {
            if (!this.isElementVisible(el) || !el.textContent.trim()) return;

            // Assign unique ID if not present
            if (!el.dataset.a11yId) {
                el.dataset.a11yId = this.generateUniqueId();
            }
            const id = el.dataset.a11yId;

            // Skip if already processed
            if (this.processedElements.has(id)) return;
            this.processedElements.add(id);

            try {
                const computedStyle = window.getComputedStyle(el);
                const textColor = this.parseColor(computedStyle.color);
                let bgColor = this.parseColor(computedStyle.backgroundColor);
                
                // If no background color, traverse up to find effective background
                if (!bgColor) {
                    bgColor = this.getEffectiveBackgroundColor(el);
                }

                if (textColor && bgColor) {
                    const contrastRatio = this.getContrastRatio(textColor, bgColor);
                    
                    if (!contrastRatio) return;

                    // Determine required contrast based on text size and weight
                    const fontSize = parseFloat(computedStyle.fontSize);
                    const fontWeight = computedStyle.fontWeight;
                    const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
                    
                    const requiredRatio = isLargeText ? 3.0 : 4.5; // WCAG AA standards
                    const requiredRatioAAA = isLargeText ? 4.5 : 7.0; // WCAG AAA standards

                    if (contrastRatio < requiredRatio) {
                        const severity = contrastRatio < 3.0 ? 'high' : 'medium';
                        const suggestedColor = this.suggestBetterColor(textColor, bgColor, requiredRatio);

                        contrastIssues.push({
                            id: id,
                            type: 'contrast',
                            element: this.getElementDescription(el),
                            suggestion: `Insufficient color contrast (${contrastRatio.toFixed(2)}:1). ${isLargeText ? 'Large text' : 'Normal text'} needs at least ${requiredRatio}:1.`,
                            severity: severity,
                            fixDetails: {
                                id: id,
                                type: 'contrast',
                                currentRatio: contrastRatio.toFixed(2),
                                requiredRatio: requiredRatio,
                                suggestedColor: suggestedColor,
                                isLargeText: isLargeText
                            }
                        });

                        // Highlight the element
                        this.highlightElement(el, id, 'warning');
                    }
                }
            } catch (error) {
                console.warn('Error checking contrast for element:', el, error);
            }
        });

        return contrastIssues;
    }

    // Suggest better color for contrast
    suggestBetterColor(textColor, bgColor, targetRatio) {
        const textLum = this.getLuminosity(textColor[0], textColor[1], textColor[2]);
        const bgLum = this.getLuminosity(bgColor[0], bgColor[1], bgColor[2]);
        
        // If background is light, suggest darker text
        if (bgLum > 0.5) {
            return textLum > 0.5 ? '#000000' : `rgb(${Math.max(0, textColor[0] - 100)}, ${Math.max(0, textColor[1] - 100)}, ${Math.max(0, textColor[2] - 100)})`;
        } else {
            // If background is dark, suggest lighter text
            return textLum < 0.5 ? '#ffffff' : `rgb(${Math.min(255, textColor[0] + 100)}, ${Math.min(255, textColor[1] + 100)}, ${Math.min(255, textColor[2] + 100)})`;
        }
    }

    // Check for other accessibility issues
    checkOtherIssues() {
        let otherIssues = [];

        // Check for missing form labels
        const formInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
        formInputs.forEach(input => {
            if (!this.isElementVisible(input)) return;

            const id = input.dataset.a11yId || this.generateUniqueId();
            input.dataset.a11yId = id;

            const hasLabel = input.labels && input.labels.length > 0;
            const hasAriaLabel = input.getAttribute('aria-label');
            const hasAriaLabelledby = input.getAttribute('aria-labelledby');
            const hasTitle = input.getAttribute('title');

            if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
                otherIssues.push({
                    id: id,
                    type: 'missingLabel',
                    element: this.getElementDescription(input),
                    suggestion: 'Form input lacks accessible label. Add a label element or aria-label attribute.',
                    fixDetails: {
                        id: id,
                        type: 'missingLabel'
                    }
                });

                this.highlightElement(input, id, 'warning');
            }
        });

        // Check for missing heading structure
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length > 0) {
            let previousLevel = 0;
            headings.forEach(heading => {
                const level = parseInt(heading.tagName.charAt(1));
                if (level > previousLevel + 1 && previousLevel !== 0) {
                    const id = heading.dataset.a11yId || this.generateUniqueId();
                    heading.dataset.a11yId = id;

                    otherIssues.push({
                        id: id,
                        type: 'headingStructure',
                        element: this.getElementDescription(heading),
                        suggestion: `Heading level skipped from h${previousLevel} to h${level}. Use sequential heading levels.`,
                        fixDetails: {
                            id: id,
                            type: 'headingStructure',
                            currentLevel: level,
                            expectedLevel: previousLevel + 1
                        }
                    });

                    this.highlightElement(heading, id, 'info');
                }
                previousLevel = level;
            });
        }

        return otherIssues;
    }

    // Get a brief description of the element
    getElementDescription(element) {
        const tagName = element.tagName.toLowerCase();
        const className = element.className ? `.${element.className.split(' ')[0]}` : '';
        const id = element.id ? `#${element.id}` : '';
        const text = element.textContent ? element.textContent.trim().substring(0, 30) + '...' : '';
        
        return `<${tagName}${id}${className}>${text}`;
    }

    // Highlight element with different colors based on issue type
    highlightElement(element, id, severity = 'error') {
        const colors = {
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        element.style.outline = `2px solid ${colors[severity]}`;
        element.style.outlineOffset = '2px';
        element.dataset.a11yHighlightId = id;
        
        // Add a subtle animation
        element.style.animation = 'a11y-highlight 2s ease-in-out';
        
        // Inject CSS for animation if not already present
        if (!document.getElementById('a11y-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'a11y-highlight-styles';
            style.textContent = `
                @keyframes a11y-highlight {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Remove all highlights
    removeAllHighlights() {
        const highlightedElements = document.querySelectorAll('[data-a11y-highlight-id]');
        highlightedElements.forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.animation = '';
            delete el.dataset.a11yHighlightId;
        });
    }

    // Main scanning function
    async scanAccessibilityIssues() {
        if (this.isScanning) {
            console.log('A11y scan already in progress...');
            return;
        }

        console.log("A11y Fix-It Assistant: Starting comprehensive scan...");
        this.isScanning = true;
        this.issues = [];
        this.processedElements.clear();
        
        // Remove previous highlights
        this.removeAllHighlights();

        try {
            // Run different checks
            const imageIssues = this.checkImageAccessibility();
            const contrastIssues = this.checkColorContrast();
            const otherIssues = this.checkOtherIssues();

            // Combine all issues
            this.issues = [...imageIssues, ...contrastIssues, ...otherIssues];

            console.log(`A11y Fix-It Assistant: Scan complete. Found ${this.issues.length} issues:`, this.issues);

            // Send issues back to the popup
            chrome.runtime.sendMessage({ 
                action: "displayIssues", 
                issues: this.issues 
            });

        } catch (error) {
            console.error('Error during accessibility scan:', error);
            chrome.runtime.sendMessage({ 
                action: "displayIssues", 
                issues: [],
                error: error.message 
            });
        } finally {
            this.isScanning = false;
        }
    }

    // Enhanced fix application
    applyFix(fixDetails) {
        try {
            const element = document.querySelector(`[data-a11y-id="${fixDetails.id}"]`);
            if (!element) {
                console.error('Element not found for fix:', fixDetails.id);
                return false;
            }

            switch (fixDetails.type) {
                case 'missingAlt':
                case 'poorAlt':
                    return this.applyAltTextFix(element, fixDetails);
                case 'contrast':
                    return this.applyContrastFix(element, fixDetails);
                case 'missingLabel':
                    return this.applyLabelFix(element, fixDetails);
                default:
                    console.warn('Unknown fix type:', fixDetails.type);
                    return false;
            }
        } catch (error) {
            console.error('Error applying fix:', error);
            return false;
        }
    }

    applyAltTextFix(element, fixDetails) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'img') {
            element.setAttribute('alt', fixDetails.altText);
        } else if (tagName === 'svg') {
            // For SVG, prefer aria-label
            element.setAttribute('aria-label', fixDetails.altText);
        } else if (tagName === 'canvas') {
            element.setAttribute('aria-label', fixDetails.altText);
        } else if (element.getAttribute('role') === 'img') {
            element.setAttribute('aria-label', fixDetails.altText);
        }

        // Remove highlight
        this.removeHighlight(element, fixDetails.id);
        
        console.log(`A11y Fix: Applied alt text "${fixDetails.altText}" to ${tagName} element`);
        return true;
    }

    applyContrastFix(element, fixDetails) {
        element.style.color = fixDetails.suggestedColor;
        
        // Remove highlight
        this.removeHighlight(element, fixDetails.id);
        
        console.log(`A11y Fix: Changed color to ${fixDetails.suggestedColor} for element`);
        return true;
    }

    applyLabelFix(element, fixDetails) {
        // Create a label or add aria-label
        const labelText = `Label for ${element.type || element.tagName.toLowerCase()} field`;
        element.setAttribute('aria-label', labelText);
        
        // Remove highlight
        this.removeHighlight(element, fixDetails.id);
        
        console.log(`A11y Fix: Added aria-label to form element`);
        return true;
    }

    removeHighlight(element, id) {
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.animation = '';
        delete element.dataset.a11yHighlightId;
    }
}

// Initialize scanner
const a11yScanner = new A11yScanner();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startScan") {
        a11yScanner.scanAccessibilityIssues();
        sendResponse({ status: "Scan initiated in content script" });
    } else if (message.action === "applyFix") {
        const success = a11yScanner.applyFix(message.fixDetails);
        sendResponse({ status: success ? "Fix applied successfully" : "Fix failed" });
    }
    return true; // Keep message channel open for async responses
});