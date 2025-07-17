// backend/utils/enhanced-document-processor.js
// Fixed version with proper initialization timing

const { GoogleDocumentAIProcessor } = require('./google-document-ai');
const { processDocumentPure } = require('./pure-pdf-processor');
const fs = require('fs').promises;
const path = require('path');

class EnhancedDocumentProcessor {
    constructor() {
        // Don't initialize Google AI immediately
        this.googleAI = null;
        this.useGoogleAI = false;
        this.initializationAttempted = false;
        
        console.log(`🤖 Enhanced Document Processor initializing...`);
        
        // Initialize Google AI lazily
        this.initializeGoogleAI();
    }

    // Lazy initialization of Google AI
    initializeGoogleAI() {
        try {
            this.googleAI = new GoogleDocumentAIProcessor();
            this.useGoogleAI = this.googleAI.isConfigured();
            this.initializationAttempted = true;
            
            console.log(`📊 Google Document AI: ${this.useGoogleAI ? '✅ Enabled' : '❌ Disabled (fallback to OCR)'}`);
            
            if (this.useGoogleAI) {
                const status = this.googleAI.getStatus();
                console.log(`📊 Google AI Status: ${JSON.stringify(status, null, 2)}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Google Document AI:', error.message);
            this.googleAI = null;
            this.useGoogleAI = false;
            this.initializationAttempted = true;
        }
    }

    // Get current status
    getStatus() {
        return {
            googleAI: this.useGoogleAI,
            initializationAttempted: this.initializationAttempted,
            googleAIStatus: this.googleAI ? this.googleAI.getStatus() : null
        };
    }

    // Main processing function that chooses the best method
    async processDocument(filePath, documentId, socketId, io) {
        const startTime = Date.now();
        
        try {
            console.log(`🚀 Starting enhanced document processing: ${path.basename(filePath)}`);

            let result;

            // Try to initialize Google AI if not already done
            if (!this.initializationAttempted) {
                this.initializeGoogleAI();
            }

            if (this.useGoogleAI && this.googleAI && this.googleAI.isConfigured()) {
                console.log('🤖 Using Google Document AI for processing...');
                result = await this.processWithGoogleAI(filePath, documentId, socketId, io);
            } else {
                console.log('🔍 Using OCR fallback processing...');
                if (!this.useGoogleAI) {
                    console.log('ℹ️ Google Document AI not available - using enhanced OCR');
                }
                result = await this.processWithOCR(filePath, documentId, socketId, io);
            }

            // Calculate processing metrics
            const processingTime = Date.now() - startTime;
            
            const metrics = {
                processingTime: processingTime,
                method: result.method,
                confidence: result.confidence || 0,
                pagesProcessed: 1,
                averageConfidence: result.confidence || 0,
                dataExtractionScore: this.calculateDataScore(result.invoiceData),
                consensusScore: result.confidence || 0
            };

            console.log(`✅ Enhanced processing completed in ${processingTime}ms`);
            console.log(`📊 Method: ${result.method}, Confidence: ${result.confidence?.toFixed(1) || 0}%`);

            return {
                extractedText: result.extractedText,
                invoiceData: result.invoiceData,
                metrics: metrics,
                extractionMethods: [result.method]
            };

        } catch (error) {
            console.error('❌ Enhanced document processing failed:', error);
            throw error;
        }
    }

    // Process with Google Document AI
    async processWithGoogleAI(filePath, documentId, socketId, io) {
        try {
            const result = await this.googleAI.processDocument(filePath, documentId, socketId, io);
            
            // Enhance the result with additional validation
            const enhancedData = this.validateAndEnhanceData(result.invoiceData);
            
            return {
                extractedText: result.extractedText,
                invoiceData: enhancedData,
                confidence: result.confidence,
                method: 'Google Document AI'
            };

        } catch (error) {
            console.warn('⚠️ Google Document AI failed, falling back to OCR:', error.message);
            return await this.processWithOCR(filePath, documentId, socketId, io);
        }
    }

    // Process with OCR fallback
    async processWithOCR(filePath, documentId, socketId, io) {
        try {
            const result = await processDocumentPure(filePath, documentId, socketId, io);
            
            return {
                extractedText: result.extractedText,
                invoiceData: result.invoiceData,
                confidence: result.metrics?.averageConfidence || 0,
                method: 'Enhanced OCR'
            };

        } catch (error) {
            console.error('❌ OCR processing also failed:', error);
            throw new Error('Both Google Document AI and OCR processing failed');
        }
    }

    // Validate and enhance extracted data
    validateAndEnhanceData(invoiceData) {
        if (!invoiceData) return invoiceData;

        // Clean up and validate invoice number
        if (invoiceData.invoiceNumber) {
            invoiceData.invoiceNumber = invoiceData.invoiceNumber.trim().replace(/[^\w\-]/g, '');
        }

        // Validate and format dates
        if (invoiceData.date) {
            invoiceData.date = this.validateDate(invoiceData.date);
        }
        if (invoiceData.dueDate) {
            invoiceData.dueDate = this.validateDate(invoiceData.dueDate);
        }

        // Clean up vendor information
        if (invoiceData.vendor) {
            if (invoiceData.vendor.name) {
                invoiceData.vendor.name = invoiceData.vendor.name.trim();
            }
            if (invoiceData.vendor.email) {
                invoiceData.vendor.email = this.validateEmail(invoiceData.vendor.email);
            }
            if (invoiceData.vendor.phone) {
                invoiceData.vendor.phone = this.formatPhoneNumber(invoiceData.vendor.phone);
            }
        }

        // Validate amounts
        if (invoiceData.amounts) {
            Object.keys(invoiceData.amounts).forEach(key => {
                if (typeof invoiceData.amounts[key] === 'number') {
                    invoiceData.amounts[key] = Math.round(invoiceData.amounts[key] * 100) / 100;
                }
            });

            // Validate currency
            if (!invoiceData.amounts.currency) {
                invoiceData.amounts.currency = 'USD';
            }
        }

        // Validate and clean line items
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
            invoiceData.items = invoiceData.items
                .filter(item => item.description && item.description.length > 2)
                .filter(item => item.amount && item.amount > 0)
                .map((item, index) => ({
                    description: item.description.trim(),
                    quantity: item.quantity || 1,
                    unitPrice: Math.round((item.unitPrice || 0) * 100) / 100,
                    amount: Math.round((item.amount || 0) * 100) / 100,
                    category: item.category || null,
                    lineNumber: index + 1
                }));
        }

        return invoiceData;
    }

    // Calculate data extraction score
    calculateDataScore(invoiceData) {
        if (!invoiceData) return 0;

        let score = 0;
        const maxScore = 100;

        // Required fields (70% of score)
        if (invoiceData.invoiceNumber) score += 20;
        if (invoiceData.date) score += 15;
        if (invoiceData.vendor?.name) score += 20;
        if (invoiceData.amounts?.total) score += 15;

        // Optional fields (30% of score)
        if (invoiceData.dueDate) score += 5;
        if (invoiceData.vendor?.email) score += 5;
        if (invoiceData.vendor?.phone) score += 5;
        if (invoiceData.amounts?.subtotal) score += 5;
        if (invoiceData.amounts?.tax) score += 5;
        if (invoiceData.items && invoiceData.items.length > 0) score += 5;

        return Math.min(score, maxScore);
    }

    // Helper validation methods
    validateDate(dateString) {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return dateString;
            return date.toISOString().split('T')[0];
        } catch {
            return dateString;
        }
    }

    validateEmail(email) {
        if (!email) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim()) ? email.trim() : null;
    }

    formatPhoneNumber(phone) {
        if (!phone) return null;
        const cleaned = phone.replace(/[^\d]/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }

    // Create comparison between Google AI and OCR results (for testing)
    async processWithBothMethods(filePath, documentId, socketId, io) {
        if (!this.useGoogleAI) {
            console.log('🔍 Google AI not configured, using OCR only');
            return await this.processWithOCR(filePath, documentId, socketId, io);
        }

        try {
            console.log('🔄 Running both Google AI and OCR for comparison...');

            // Process with both methods
            const [googleResult, ocrResult] = await Promise.allSettled([
                this.processWithGoogleAI(filePath, documentId, socketId, io),
                this.processWithOCR(filePath, documentId, socketId, io)
            ]);

            const comparison = {
                googleAI: googleResult.status === 'fulfilled' ? googleResult.value : null,
                ocr: ocrResult.status === 'fulfilled' ? ocrResult.value : null,
                comparison: null
            };

            // Create comparison if both succeeded
            if (comparison.googleAI && comparison.ocr) {
                comparison.comparison = this.compareResults(comparison.googleAI, comparison.ocr);
                console.log('📊 Method comparison completed');
            }

            // Return the better result (prefer Google AI if available)
            const bestResult = comparison.googleAI || comparison.ocr;
            bestResult.methodComparison = comparison.comparison;

            return bestResult;

        } catch (error) {
            console.error('❌ Comparison processing failed:', error);
            throw error;
        }
    }

    // Compare results from different methods
    compareResults(googleResult, ocrResult) {
        const comparison = {
            confidence: {
                googleAI: googleResult.confidence,
                ocr: ocrResult.confidence,
                winner: googleResult.confidence > ocrResult.confidence ? 'Google AI' : 'OCR'
            },
            fieldsExtracted: {
                googleAI: this.countExtractedFields(googleResult.invoiceData),
                ocr: this.countExtractedFields(ocrResult.invoiceData),
                winner: null
            },
            lineItems: {
                googleAI: googleResult.invoiceData.items?.length || 0,
                ocr: ocrResult.invoiceData.items?.length || 0,
                winner: null
            }
        };

        comparison.fieldsExtracted.winner = comparison.fieldsExtracted.googleAI > comparison.fieldsExtracted.ocr ? 'Google AI' : 'OCR';
        comparison.lineItems.winner = comparison.lineItems.googleAI > comparison.lineItems.ocr ? 'Google AI' : 'OCR';

        return comparison;
    }

    countExtractedFields(invoiceData) {
        if (!invoiceData) return 0;
        
        let count = 0;
        if (invoiceData.invoiceNumber) count++;
        if (invoiceData.date) count++;
        if (invoiceData.vendor?.name) count++;
        if (invoiceData.amounts?.total) count++;
        if (invoiceData.items?.length > 0) count++;
        
        return count;
    }
}

module.exports = {
    EnhancedDocumentProcessor
};