// backend/utils/enhanced-line-items-extraction.js
// Improved line items extraction that separates actual items from totals/taxes

function extractLineItemsOnly(text) {
    console.log('🔍 Extracting line items (excluding totals/taxes)...');
    
    if (!text || text.length < 10) {
        return [];
    }
    
    // Keywords that indicate summary lines (NOT line items)
    const summaryKeywords = [
        'subtotal', 'sub-total', 'sub total',
        'total', 'grand total', 'final total',
        'tax', 'vat', 'gst', 'hst', 'sales tax',
        'freight', 'shipping', 'delivery',
        'discount', 'credit', 'adjustment',
        'balance', 'due', 'paid', 'amount due',
        'net amount', 'gross amount',
        'handling', 'processing fee',
        'service charge', 'convenience fee', 'SST'
    ];
    
    // Common line item patterns with amounts
    const lineItemPatterns = [
        // Description followed by quantity, price, and amount
        /^(.{10,80}?)\s+(\d+(?:\.\d+)?)\s+[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2})?)\s+[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2})?)$/m,
        
        // Description with amount at the end (no explicit quantity/price)
        /^(.{10,80}?)\s+[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2}))$/m,
        
        // Item with code/SKU: CODE Description Amount
        /^([A-Z0-9\-]{3,15})\s+(.{10,60}?)\s+[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2}))$/m,
        
        // Quantity × Price = Amount format
        /^(.{10,80}?)\s+(\d+(?:\.\d+)?)\s*[×x]\s*[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2})?)\s*=\s*[\$£€¥₹C\$]?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2}))$/m
    ];
    
    const lines = text.split('\n');
    const potentialItems = [];
    
    // First pass: Find lines that look like items
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (line.length < 5) continue;
        
        // Skip obvious header lines
        if (isHeaderLine(line)) continue;
        
        // Skip lines that are clearly summary/total lines
        if (isSummaryLine(line, summaryKeywords)) continue;
        
        // Try to match line item patterns
        for (const pattern of lineItemPatterns) {
            const match = line.match(pattern);
            if (match) {
                const item = parseLineItemMatch(match, pattern);
                if (item && isValidLineItem(item)) {
                    potentialItems.push({
                        ...item,
                        lineNumber: i + 1,
                        originalLine: line
                    });
                    break; // Found a match, don't try other patterns
                }
            }
        }
    }
    
    // Second pass: Clean up and validate items
    const cleanedItems = potentialItems
        .filter(item => isValidLineItem(item))
        .filter(item => !isDuplicateTotal(item, potentialItems))
        .map((item, index) => ({
            description: cleanDescription(item.description),
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.amount,
            amount: item.amount,
            reference: item.reference || null,
            category: inferCategory(item.description),
            lineNumber: index + 1
        }));
    
    console.log(`📦 Found ${cleanedItems.length} valid line items`);
    return cleanedItems.slice(0, 20); // Limit to 20 items max
}

function isHeaderLine(line) {
    const headerPatterns = [
        /^(description|item|product|service|qty|quantity|price|rate|amount|total)[\s\|]*$/i,
        /^[\-=\s\|]+$/,
        /^(invoice|bill|statement|estimate)/i,
        /^(date|number|#|ref)/i
    ];
    
    return headerPatterns.some(pattern => pattern.test(line.trim()));
}

function isSummaryLine(line, summaryKeywords) {
    const lowerLine = line.toLowerCase();
    
    // Check for summary keywords
    const hasSummaryKeyword = summaryKeywords.some(keyword => 
        lowerLine.includes(keyword.toLowerCase())
    );
    
    if (hasSummaryKeyword) {
        // Additional check: make sure it's actually a summary line
        // (not just a description that mentions "total" or "tax")
        const summaryPatterns = [
            /^(sub\s*)?total[\s:]+/i,
            /^tax[\s:]+/i,
            /^freight[\s:]+/i,
            /^discount[\s:]+/i,
            /amount\s+(due|paid)[\s:]/i,
            /balance[\s:]+/i
        ];
        
        return summaryPatterns.some(pattern => pattern.test(line));
    }
    
    return false;
}

function parseLineItemMatch(match, pattern) {
    // Different parsing based on pattern structure
    if (match.length === 5) {
        // Full pattern: description, qty, price, amount
        return {
            description: match[1].trim(),
            quantity: parseFloat(match[2]) || 1,
            unitPrice: parseFloat(match[3].replace(/[,]/g, '')) || 0,
            amount: parseFloat(match[4].replace(/[,]/g, '')) || 0
        };
    } else if (match.length === 4) {
        // Code + description + amount, or description + amount
        if (match[1].length < 20 && /^[A-Z0-9\-]+$/.test(match[1])) {
            // Likely item code
            return {
                description: match[2].trim(),
                reference: match[1].trim(),
                quantity: 1,
                amount: parseFloat(match[3].replace(/[,]/g, '')) || 0,
                unitPrice: parseFloat(match[3].replace(/[,]/g, '')) || 0
            };
        } else {
            // Description with qty, price, amount
            return {
                description: match[1].trim(),
                quantity: parseFloat(match[2]) || 1,
                unitPrice: parseFloat(match[3].replace(/[,]/g, '')) || 0,
                amount: parseFloat(match[3].replace(/[,]/g, '')) || 0
            };
        }
    } else if (match.length === 3) {
        // Simple description + amount
        return {
            description: match[1].trim(),
            quantity: 1,
            amount: parseFloat(match[2].replace(/[,]/g, '')) || 0,
            unitPrice: parseFloat(match[2].replace(/[,]/g, '')) || 0
        };
    }
    
    return null;
}

function isValidLineItem(item) {
    if (!item || !item.description) return false;
    
    // Description must be meaningful
    if (item.description.length < 3 || item.description.length > 200) return false;
    
    // Amount must be reasonable
    if (!item.amount || item.amount <= 0 || item.amount > 1000000) return false;
    
    // Quantity must be reasonable
    if (item.quantity && (item.quantity <= 0 || item.quantity > 10000)) return false;
    
    // Check for obvious non-item descriptions
    const nonItemPatterns = [
        /^[\d\s\-\.\$£€¥₹,]+$/,  // Only numbers/symbols
        /^[A-Z\s]+$/,             // Only uppercase letters
        /thank\s*you/i,
        /page\s*\d+/i,
        /continued/i,
        /^total[\s\$£€¥₹]/i
    ];
    
    return !nonItemPatterns.some(pattern => pattern.test(item.description));
}

function isDuplicateTotal(item, allItems) {
    // Check if this item's amount matches any obvious total
    const totalAmount = allItems.reduce((sum, otherItem) => {
        return otherItem !== item ? sum + (otherItem.amount || 0) : sum;
    }, 0);
    
    // If item amount equals sum of other items, it's likely a total line
    return Math.abs(item.amount - totalAmount) < 0.01;
}

function cleanDescription(description) {
    if (!description) return '';
    
    return description
        .replace(/^[\d\s\-\.]+/, '')     // Remove leading numbers/punctuation
        .replace(/[\$£€¥₹\d\.,\s]*$/, '') // Remove trailing amounts
        .replace(/\s+/g, ' ')           // Normalize spaces
        .trim();
}

function inferCategory(description) {
    if (!description) return null;
    
    const lowerDesc = description.toLowerCase();
    
    const categories = {
        'Software': ['software', 'license', 'subscription', 'saas', 'app'],
        'Hardware': ['hardware', 'computer', 'server', 'device', 'equipment'],
        'Service': ['service', 'consulting', 'support', 'maintenance', 'training'],
        'Hosting': ['hosting', 'cloud', 'server', 'storage', 'bandwidth'],
        'Development': ['development', 'programming', 'coding', 'custom'],
        'Security': ['security', 'firewall', 'antivirus', 'ssl', 'encryption'],
        'Design': ['design', 'graphic', 'ui', 'ux', 'creative'],
        'Marketing': ['marketing', 'advertising', 'seo', 'social', 'campaign']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => lowerDesc.includes(keyword))) {
            return category;
        }
    }
    
    return null;
}

// Enhanced regex extraction with improved line items
function enhancedRegexExtractionWithFixedItems(text) {
    console.log('🔍 Starting enhanced regex extraction with fixed line items...');
    
    const result = {
        invoiceNumber: null,
        date: null,
        dueDate: null,
        vendor: {
            name: null,
            address: null,
            phone: null,
            email: null,
            website: null,
            taxId: null
        },
        billTo: {
            name: null,
            address: null,
            phone: null,
            email: null
        },
        amounts: {
            subtotal: null,
            tax: null,
            taxRate: null,
            discount: null,
            total: null,
            amountPaid: null,
            balanceDue: null,
            currency: 'USD'
        },
        items: [],
        paymentDetails: {
            method: null,
            terms: null,
            bankDetails: null
        },
        orderInfo: {
            orderNumber: null,
            orderDate: null,
            reference: null
        },
        notes: null
    };
    
    if (!text || text.length < 10) {
        console.warn('⚠️ Text too short for extraction');
        return result;
    }
    
    try {
        // Extract line items FIRST (before other extractions)
        result.items = extractLineItemsOnly(text);
        
        // Invoice Number - Enhanced patterns
        const invoicePatterns = [
            /(?:invoice\s*(?:number|#|no\.?)?[:\s]*([A-Z0-9\-]{3,20}))/i,
            /(?:inv\s*(?:number|#|no\.?)?[:\s]*([A-Z0-9\-]{3,20}))/i,
            /(?:bill\s*(?:number|#|no\.?)?[:\s]*([A-Z0-9\-]{3,20}))/i,
            /#([A-Z0-9\-]{5,20})/,
            /(?:^|\s)([A-Z]{2,4}[-\s]?\d{4,8})(?:\s|$)/
        ];
        
        for (const pattern of invoicePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                result.invoiceNumber = match[1].trim();
                console.log(`📄 Found invoice number: ${result.invoiceNumber}`);
                break;
            }
        }
        
        // Date extraction
        const datePatterns = [
            /(?:invoice\s*date|date|issued)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
            /(?:date)[:\s]*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
            /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
            /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/
        ];
        
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                result.date = match[1].trim();
                console.log(`📅 Found date: ${result.date}`);
                break;
            }
        }
        
        // Due Date
        const dueDateMatch = text.match(/(?:due\s*date|payment\s*due)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
        if (dueDateMatch) {
            result.dueDate = dueDateMatch[1].trim();
            console.log(`📅 Found due date: ${result.dueDate}`);
        }
        
        // Vendor Name - Look for company names at the beginning
        const vendorPatterns = [
            /(?:from|bill\s*from|vendor)[:\s]*([A-Z][^\n]{10,50})/i,
            /^([A-Z][A-Za-z\s&\.,]{5,50})(?:\n|$)/m,
            /(?:^|\n)([A-Z][A-Za-z\s&\.,]{10,50})\s*(?:inc|llc|ltd|corp|co\.)/im
        ];
        
        for (const pattern of vendorPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                result.vendor.name = match[1].trim();
                console.log(`🏢 Found vendor: ${result.vendor.name}`);
                break;
            }
        }
        
        // Email addresses
        const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            result.vendor.email = emailMatch[1];
            console.log(`📧 Found email: ${result.vendor.email}`);
        }
        
        // Phone numbers
        const phoneMatch = text.match(/(?:phone|tel|call)[:\s]*([0-9\-\.\(\)\s]{10,20})/i) || 
                          text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
        if (phoneMatch) {
            result.vendor.phone = phoneMatch[1].trim();
            console.log(`📞 Found phone: ${result.vendor.phone}`);
        }
        
        // SEPARATE AMOUNT EXTRACTION (not from line items)
        
        // Subtotal (exclude line items)
        const subtotalPattern = /(?:^|\n)\s*(?:subtotal|sub\s*total)[\s:]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/im;
        const subtotalMatch = text.match(subtotalPattern);
        if (subtotalMatch) {
            result.amounts.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
            console.log(`💰 Found subtotal: ${result.amounts.subtotal}`);
        }
        
        // Tax (exclude line items)
        const taxPattern = /(?:^|\n)\s*(?:tax|vat|gst)[\s:]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/im;
        const taxMatch = text.match(taxPattern);
        if (taxMatch) {
            result.amounts.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
            console.log(`💰 Found tax: ${result.amounts.tax}`);
        }
        
        // Total (exclude line items)
        const totalPattern = /(?:^|\n)\s*(?:total|grand\s*total|amount\s*due|final\s*total)[\s:]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/im;
        const totalMatch = text.match(totalPattern);
        if (totalMatch) {
            result.amounts.total = parseFloat(totalMatch[1].replace(/,/g, ''));
            console.log(`💰 Found total: ${result.amounts.total}`);
        }
        
        // Currency detection
        if (text.includes('CAD') || text.includes('C$')) {
            result.amounts.currency = 'CAD';
        } else if (text.includes('€') || text.includes('EUR')) {
            result.amounts.currency = 'EUR';
        } else if (text.includes('£') || text.includes('GBP')) {
            result.amounts.currency = 'GBP';
        } else if (text.includes('₹') || text.includes('INR')) {
            result.amounts.currency = 'INR';
        }
        
        console.log(`💱 Currency: ${result.amounts.currency}`);
        console.log(`📦 Extracted ${result.items.length} line items (excluding totals)`);
        
    } catch (error) {
        console.error('❌ Regex extraction error:', error);
    }
    
    console.log('✅ Enhanced regex extraction completed with fixed line items');
    return result;
}

module.exports = {
    extractLineItemsOnly,
    enhancedRegexExtractionWithFixedItems,
    isValidLineItem,
    cleanDescription,
    inferCategory
};