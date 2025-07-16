// backend/utils/enhanced-ocr-extraction.js
// Clean version with no syntax errors

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { tesseractManager } = require('./tesseract-manager');

// Enhanced image preprocessing
async function enhancedPreprocessImage(imagePath) {
    try {
        console.log(`🖼️ Preprocessing image: ${path.basename(imagePath)}`);

        const outputPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');

        await sharp(imagePath)
            .resize(null, 2000, {
                withoutEnlargement: false,
                kernel: sharp.kernel.cubic
            })
            .sharpen({ sigma: 1.5, flat: 2, jagged: 3 })
            .normalize()
            .threshold(128)
            .png({
                quality: 100,
                compressionLevel: 0,
                palette: false
            })
            .toFile(outputPath);

        console.log(`✅ Image preprocessed: ${path.basename(outputPath)}`);
        return outputPath;

    } catch (error) {
        console.error('❌ Image preprocessing failed:', error);
        // Return original path if preprocessing fails
        return imagePath;
    }
}

// Enhanced OCR with multiple PSM modes and retry logic
async function performEnhancedOCR(imagePath, documentId, socketId, pageNumber = 1) {
    try {
        console.log(`🔍 Starting enhanced OCR for page ${pageNumber}`);

        // Try different page segmentation modes
        const psmModes = [
            { mode: 6, name: 'AUTO' },      // Default - Uniform block of text
            { mode: 3, name: 'FULLY_AUTO' }, // Fully automatic page segmentation
            { mode: 1, name: 'SINGLE_COLUMN' }, // Single uniform column
            { mode: 4, name: 'SINGLE_COLUMN_VAR' } // Single column, variable sizes
        ];

        let bestResult = null;
        let bestConfidence = 0;

        for (const psm of psmModes) {
            try {
                console.log(`🔍 Trying PSM mode ${psm.mode} (${psm.name})`);

                const result = await tesseractManager.performOCR(imagePath, {
                    pageseg: psm.mode
                });

                // Only consider results with reasonable confidence and text length
                if (result.confidence > bestConfidence && result.text.length > 50) {
                    bestResult = result;
                    bestConfidence = result.confidence;
                    bestResult.mode = psm.name;
                }

                console.log(`📊 PSM ${psm.mode}: ${result.confidence.toFixed(1)}% confidence, ${result.text.length} chars`);

                // If we get a very good result, stop trying other modes
                if (result.confidence > 85 && result.text.length > 100) {
                    console.log(`✅ Excellent result with PSM ${psm.mode}, stopping here`);
                    break;
                }

            } catch (psmError) {
                console.warn(`⚠️ PSM mode ${psm.mode} failed:`, psmError.message);
                continue;
            }
        }

        if (!bestResult || bestResult.text.length < 10) {
            throw new Error('OCR failed to extract meaningful text with any PSM mode');
        }

        // Post-process the text
        const cleanedText = postProcessOCRText(bestResult.text);

        console.log(`✅ Enhanced OCR completed for page ${pageNumber}`);
        console.log(`📊 Best result: ${bestConfidence.toFixed(1)}% confidence (${bestResult.mode} mode)`);
        console.log(`📝 Text length: ${cleanedText.length} characters`);

        return {
            text: cleanedText,
            confidence: bestConfidence,
            mode: bestResult.mode,
            words: bestResult.words,
            lines: bestResult.lines,
            paragraphs: bestResult.paragraphs
        };

    } catch (error) {
        console.error(`❌ Enhanced OCR failed for page ${pageNumber}:`, error);

        // Return minimal result instead of throwing
        return {
            text: '',
            confidence: 0,
            mode: 'FAILED',
            words: [],
            lines: [],
            paragraphs: []
        };
    }
}

// Improved text post-processing
function postProcessOCRText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let processed = text;

    // Remove excessive whitespace and normalize line breaks
    processed = processed
        .replace(/\r\n/g, '\n')           // Normalize line endings
        .replace(/\r/g, '\n')             // Convert remaining \r to \n
        .replace(/\n{3,}/g, '\n\n')       // Reduce multiple line breaks
        .replace(/[ \t]+/g, ' ')          // Normalize spaces and tabs
        .replace(/^\s+|\s+$/gm, '')       // Trim each line
        .trim();                          // Trim overall

    // Fix common OCR errors
    const corrections = [
        // Currency symbols
        [/\bS\s*\$|\$\s*S/g, '$'],
        [/\bC\s*\$|\$\s*C/g, 'C$'],

        // Common character substitutions
        [/([0-9])\s*O\s*([0-9])/g, '$1 0 $2'], // O to 0 in numbers
        [/([A-Za-z])\s*0\s*([A-Za-z])/g, '$1 O $2'], // 0 to O in words
        [/\bI(?=nvoice)/gi, 'I'],         // Common "I" replacements
        [/\bl(?=nvoice)/gi, 'I'],
        [/\b1(?=nvoice)/gi, 'I'],

        // Date formats
        [/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g, '$1/$2/$3'],

        // Phone numbers
        [/(\d{3})\s*[-\.\s]\s*(\d{3})\s*[-\.\s]\s*(\d{4})/g, '$1-$2-$3'],

        // Email addresses
        [/(\w+)\s*@\s*(\w+)\s*\.\s*(\w+)/g, '$1@$2.$3'],
    ];

    corrections.forEach(([pattern, replacement]) => {
        processed = processed.replace(pattern, replacement);
    });

    return processed;
}

// Enhanced regex extraction - uses external module if available
function enhancedRegexExtraction(text) {
    console.log('🔍 Starting enhanced regex extraction...');

    try {
        // Try to use the enhanced line items extraction
        const { enhancedRegexExtractionWithFixedItems } = require('./enhanced-line-items-extraction');
        return enhancedRegexExtractionWithFixedItems(text);
    } catch (error) {
        console.warn('⚠️ Enhanced line items extraction not available, using basic extraction');
        return basicRegexExtraction(text);
    }
}

// Basic regex extraction as fallback
function basicRegexExtraction(text) {
    console.log('🔍 Using basic regex extraction...');

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
        // Invoice Number
        const invoiceMatch = text.match(/(?:invoice\s*(?:number|#|no\.?)?[:\s]*([A-Z0-9\-]{3,20}))/i);
        if (invoiceMatch) {
            result.invoiceNumber = invoiceMatch[1].trim();
            console.log(`📄 Found invoice number: ${result.invoiceNumber}`);
        }

        // Date
        const dateMatch = text.match(/(?:invoice\s*date|date|issued)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
        if (dateMatch) {
            result.date = dateMatch[1].trim();
            console.log(`📅 Found date: ${result.date}`);
        }

        // Due Date
        const dueDateMatch = text.match(/(?:due\s*date|payment\s*due)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
        if (dueDateMatch) {
            result.dueDate = dueDateMatch[1].trim();
            console.log(`📅 Found due date: ${result.dueDate}`);
        }

        // Vendor Name
        const vendorMatch = text.match(/^([A-Z][A-Za-z\s&\.,]{5,50})(?:\n|$)/m);
        if (vendorMatch) {
            result.vendor.name = vendorMatch[1].trim();
            console.log(`🏢 Found vendor: ${result.vendor.name}`);
        }

        // Email
        const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            result.vendor.email = emailMatch[1];
            console.log(`📧 Found email: ${result.vendor.email}`);
        }

        // Phone
        const phoneMatch = text.match(/(?:phone|tel|call)[:\s]*([0-9\-\.\(\)\s]{10,20})/i) ||
            text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
        if (phoneMatch) {
            result.vendor.phone = phoneMatch[1].trim();
            console.log(`📞 Found phone: ${result.vendor.phone}`);
        }

        // Total amount
        const totalMatch = text.match(/(?:total|grand\s*total|amount\s*due)[:\s]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/i);
        if (totalMatch) {
            result.amounts.total = parseFloat(totalMatch[1].replace(/,/g, ''));
            console.log(`💰 Found total: ${result.amounts.total}`);
        }

        // Subtotal
        const subtotalMatch = text.match(/(?:subtotal|sub\s*total)[:\s]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/i);
        if (subtotalMatch) {
            result.amounts.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
            console.log(`💰 Found subtotal: ${result.amounts.subtotal}`);
        }

        // Tax
        const taxMatch = text.match(/(?:tax|vat|gst)[:\s]*[\$£€¥₹C\$]?\s*([0-9,]+\.?\d{0,2})/i);
        if (taxMatch) {
            result.amounts.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
            console.log(`💰 Found tax: ${result.amounts.tax}`);
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

        // Basic line items extraction (improved to avoid totals)
        const lines = text.split('\n');
        const excludeKeywords = ['total', 'subtotal', 'tax', 'due', 'balance', 'freight', 'shipping'];

        const itemLines = lines.filter(line => {
            const lowerLine = line.toLowerCase();
            const hasAmount = /[\$£€¥₹C\$]?\s*\d+[\.,]\d{2}/.test(line);
            const isNotSummary = !excludeKeywords.some(keyword => lowerLine.includes(keyword));
            const isReasonableLength = line.length > 10 && line.length < 100;

            return hasAmount && isNotSummary && isReasonableLength;
        });

        result.items = itemLines.slice(0, 10).map((line, index) => {
            const amountMatch = line.match(/([\$£€¥₹C\$]?\s*\d+[\.,]\d{2})/);
            const amount = amountMatch ? parseFloat(amountMatch[1].replace(/[^\d\.]/g, '')) : 0;
            const description = line.replace(/([\$£€¥₹C\$]?\s*\d+[\.,]\d{2}).*$/, '').trim();

            return {
                description: description,
                quantity: 1,
                unitPrice: amount,
                amount: amount,
                lineNumber: index + 1
            };
        });

        if (result.items.length > 0) {
            console.log(`📦 Found ${result.items.length} line items`);
        }

    } catch (error) {
        console.error('❌ Basic regex extraction error:', error);
    }

    console.log('✅ Basic regex extraction completed');
    return result;
}

// Create enhanced LLM prompt
function createEnhancedLLMPrompt(text) {
    return `
Please extract comprehensive invoice data from the following text and return it as valid JSON.

Text to analyze:
"""
${text.substring(0, 4000)} // Limit text to prevent token overflow
"""

Return a JSON object with this exact structure:
{
  "invoiceNumber": "string or null",
  "date": "string or null",
  "dueDate": "string or null",
  "vendor": {
    "name": "string or null",
    "address": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "website": "string or null",
    "taxId": "string or null"
  },
  "billTo": {
    "name": "string or null",
    "address": "string or null",
    "phone": "string or null",
    "email": "string or null"
  },
  "amounts": {
    "subtotal": number or null,
    "tax": number or null,
    "taxRate": "string or null",
    "discount": number or null,
    "total": number or null,
    "amountPaid": number or null,
    "balanceDue": number or null,
    "currency": "string (USD, CAD, EUR, etc.)"
  },
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "amount": number,
      "category": "string or null"
    }
  ],
  "paymentDetails": {
    "method": "string or null",
    "terms": "string or null",
    "instructions": "string or null"
  },
  "orderInfo": {
    "orderNumber": "string or null",
    "orderDate": "string or null",
    "reference": "string or null"
  },
  "notes": "string or null"
}

Important instructions:
1. Extract ALL line items with descriptions, quantities, unit prices, and amounts
2. Include all vendor contact information found
3. Parse all monetary amounts as numbers (no currency symbols)
4. Identify the correct currency (USD, CAD, EUR, GBP, INR, etc.)
5. Extract payment terms and methods if mentioned
6. Return valid JSON only, no explanations
`;
}

module.exports = {
    enhancedPreprocessImage,
    performEnhancedOCR,
    enhancedRegexExtraction,
    createEnhancedLLMPrompt,
    postProcessOCRText,
    basicRegexExtraction
};