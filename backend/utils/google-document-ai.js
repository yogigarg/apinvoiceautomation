// backend/utils/google-document-ai.js
// Fixed version that properly handles environment variables and timing

const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const fs = require('fs');
const path = require('path');

class GoogleDocumentAIProcessor {
    constructor() {
        // Don't initialize immediately, wait for proper initialization
        this.client = null;
        this.processorName = null;
        this.isInitialized = false;
        this.initializationError = null;
        
        // Initialize lazily when first used
        this.initialize();
    }

    // Lazy initialization that respects environment variables
    initialize() {
        try {
            console.log('🔧 Initializing Google Document AI...');
            
            // Check environment variables are available
            this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
            this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
            this.processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
            this.processorVersion = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION || 'rc';
            this.credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

            console.log('📊 Google AI Configuration Check:');
            console.log(`   Project ID: ${this.projectId ? '✅ ' + this.projectId : '❌ Missing'}`);
            console.log(`   Location: ${this.location}`);
            console.log(`   Processor ID: ${this.processorId ? '✅ ' + this.processorId.substring(0, 8) + '...' : '❌ Missing'}`);
            console.log(`   Credentials: ${this.credentialsPath ? '✅ ' + this.credentialsPath : '❌ Missing'}`);

            // Check if all required config is present
            if (!this.projectId || !this.processorId || !this.credentialsPath) {
                const missing = [];
                if (!this.projectId) missing.push('GOOGLE_CLOUD_PROJECT_ID');
                if (!this.processorId) missing.push('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
                if (!this.credentialsPath) missing.push('GOOGLE_APPLICATION_CREDENTIALS');
                
                throw new Error(`Missing required configuration: ${missing.join(', ')}`);
            }

            // Check if credentials file exists
            const fullCredentialsPath = path.resolve(this.credentialsPath);
            console.log(`🔍 Checking credentials file: ${fullCredentialsPath}`);
            
            if (!fs.existsSync(fullCredentialsPath)) {
                throw new Error(`Credentials file not found: ${fullCredentialsPath}`);
            }

            // Validate credentials file
            try {
                const credentialsContent = fs.readFileSync(fullCredentialsPath, 'utf8');
                const credentials = JSON.parse(credentialsContent);
                
                if (!credentials.type || !credentials.project_id || !credentials.client_email) {
                    throw new Error('Invalid credentials file format');
                }
                
                console.log(`✅ Credentials file validated for project: ${credentials.project_id}`);
                
                // Check if project IDs match
                if (credentials.project_id !== this.projectId) {
                    console.warn(`⚠️ Warning: Project ID mismatch! Env: ${this.projectId}, Credentials: ${credentials.project_id}`);
                }
                
            } catch (jsonError) {
                throw new Error(`Invalid credentials JSON: ${jsonError.message}`);
            }

            // Initialize the client
            this.client = new DocumentProcessorServiceClient({
                keyFilename: fullCredentialsPath,
                projectId: this.projectId
            });

            // Build processor name
            this.processorName = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}/processorVersions/${this.processorVersion}`;
            
            console.log('✅ Google Document AI client initialized successfully');
            console.log(`📍 Processor: ${this.processorName}`);
            
            this.isInitialized = true;
            return true;

        } catch (error) {
            console.error('❌ Google Document AI initialization failed:', error.message);
            this.initializationError = error.message;
            this.isInitialized = false;
            return false;
        }
    }

    // Check if properly configured and initialized
    isConfigured() {
        return this.isInitialized && this.client && this.processorName;
    }

    // Get initialization status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isConfigured: this.isConfigured(),
            error: this.initializationError,
            processorName: this.processorName,
            projectId: this.projectId,
            processorId: this.processorId ? this.processorId.substring(0, 8) + '...' : null
        };
    }

    // Process document with Google Document AI
    async processDocument(filePath, documentId, socketId, io) {
        try {
            // Ensure we're properly initialized
            if (!this.isConfigured()) {
                // Try to initialize again
                const initialized = this.initialize();
                if (!initialized) {
                    throw new Error(`Google Document AI not properly configured: ${this.initializationError}`);
                }
            }

            console.log(`🤖 Starting Google Document AI processing: ${path.basename(filePath)}`);

            if (socketId && io) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'google_ai_processing',
                    progress: 10,
                    message: 'Sending document to Google Document AI...'
                });
            }

            // Read the file
            const imageFile = fs.readFileSync(filePath);
            const encodedImage = Buffer.from(imageFile).toString('base64');

            // Determine MIME type
            const mimeType = this.getMimeType(filePath);

            // Create the request
            const request = {
                name: this.processorName,
                rawDocument: {
                    content: encodedImage,
                    mimeType: mimeType,
                },
            };

            console.log(`📤 Sending to Google Document AI (${mimeType})`);

            if (socketId && io) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'google_ai_processing',
                    progress: 30,
                    message: 'Google AI is analyzing the document...'
                });
            }

            // Process the document
            const [result] = await this.client.processDocument(request);
            const { document } = result;

            console.log('✅ Google Document AI processing completed');

            if (socketId && io) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'google_ai_processing',
                    progress: 70,
                    message: 'Parsing AI results...'
                });
            }

            // Extract and structure the data
            const extractedData = this.parseDocumentAIResponse(document);

            if (socketId && io) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'google_ai_processing',
                    progress: 90,
                    message: 'Finalizing extraction...'
                });
            }

            console.log(`📊 Google AI Extraction Summary:`);
            console.log(`   📄 Invoice #: ${extractedData.invoiceNumber || 'Not found'}`);
            console.log(`   🏢 Vendor: ${extractedData.vendor?.name || 'Not found'}`);
            console.log(`   💰 Total: ${extractedData.amounts?.currency || ''}${extractedData.amounts?.total || 'Not found'}`);
            console.log(`   📦 Line Items: ${extractedData.items?.length || 0}`);
            console.log(`   📝 Confidence: ${extractedData.confidence?.toFixed(1) || 0}%`);

            return {
                extractedText: document.text || '',
                invoiceData: extractedData,
                confidence: extractedData.confidence || 0,
                method: 'Google Document AI',
                rawResponse: document // For debugging
            };

        } catch (error) {
            console.error('❌ Google Document AI processing failed:', error.message);
            throw new Error(`Google Document AI failed: ${error.message}`);
        }
    }

    // Parse Document AI response into structured invoice data
    parseDocumentAIResponse(document) {
        console.log('🔍 Parsing Google Document AI response...');

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
            notes: null,
            confidence: 0
        };

        if (!document || !document.entities) {
            console.warn('⚠️ No entities found in Document AI response');
            return result;
        }

        let totalConfidence = 0;
        let entityCount = 0;

        // Process each entity
        for (const entity of document.entities) {
            const entityType = entity.type;
            const mentionText = entity.mentionText;
            const confidence = entity.confidence || 0;

            totalConfidence += confidence;
            entityCount++;

            console.log(`📋 Found entity: ${entityType} = "${mentionText}" (${(confidence * 100).toFixed(1)}%)`);

            // Map Document AI entity types to our structure
            switch (entityType) {
                case 'invoice_id':
                case 'invoice_number':
                    result.invoiceNumber = mentionText;
                    break;

                case 'invoice_date':
                    result.date = this.formatDate(mentionText);
                    break;

                case 'due_date':
                    result.dueDate = this.formatDate(mentionText);
                    break;

                case 'supplier_name':
                case 'vendor_name':
                    result.vendor.name = mentionText;
                    break;

                case 'supplier_address':
                case 'vendor_address':
                    result.vendor.address = mentionText;
                    break;

                case 'supplier_phone':
                case 'vendor_phone':
                    result.vendor.phone = mentionText;
                    break;

                case 'supplier_email':
                case 'vendor_email':
                    result.vendor.email = mentionText;
                    break;

                case 'supplier_website':
                    result.vendor.website = mentionText;
                    break;

                case 'supplier_tax_id':
                case 'vendor_tax_id':
                    result.vendor.taxId = mentionText;
                    break;

                case 'customer_name':
                case 'bill_to_name':
                    result.billTo.name = mentionText;
                    break;

                case 'customer_address':
                case 'bill_to_address':
                    result.billTo.address = mentionText;
                    break;

                case 'total_amount':
                case 'invoice_total':
                    result.amounts.total = this.parseAmount(mentionText);
                    break;

                case 'net_amount':
                case 'subtotal_amount':
                    result.amounts.subtotal = this.parseAmount(mentionText);
                    break;

                case 'total_tax_amount':
                case 'tax_amount':
                    result.amounts.tax = this.parseAmount(mentionText);
                    break;

                case 'currency':
                    result.amounts.currency = mentionText;
                    break;

                case 'payment_terms':
                    result.paymentDetails.terms = mentionText;
                    break;

                case 'purchase_order':
                case 'order_number':
                    result.orderInfo.orderNumber = mentionText;
                    break;

                default:
                    console.log(`ℹ️ Unhandled entity type: ${entityType}`);
                    break;
            }
        }

        // Extract line items from tables
        if (document.pages && document.pages.length > 0) {
            result.items = this.extractLineItems(document.pages[0]);
        }

        // Calculate overall confidence
        result.confidence = entityCount > 0 ? (totalConfidence / entityCount) * 100 : 0;

        console.log(`✅ Document AI parsing completed with ${entityCount} entities`);
        return result;
    }

    // Extract line items from table data
    extractLineItems(page) {
        const items = [];

        if (!page.tables || page.tables.length === 0) {
            console.log('ℹ️ No tables found for line item extraction');
            return items;
        }

        console.log(`📊 Processing ${page.tables.length} table(s) for line items`);

        for (const table of page.tables) {
            if (!table.bodyRows || table.bodyRows.length === 0) continue;

            // Process each row (simplified extraction)
            for (let rowIndex = 0; rowIndex < Math.min(table.bodyRows.length, 20); rowIndex++) {
                const row = table.bodyRows[rowIndex];
                
                if (row.cells && row.cells.length >= 2) {
                    const description = this.extractTextFromCell(row.cells[0] || {});
                    const amount = this.parseAmount(this.extractTextFromCell(row.cells[row.cells.length - 1] || {}));
                    
                    if (description && description.length > 3 && amount && amount > 0) {
                        // Filter out summary rows
                        const descLower = description.toLowerCase();
                        const summaryKeywords = ['total', 'subtotal', 'tax', 'shipping', 'discount'];
                        
                        if (!summaryKeywords.some(keyword => descLower.includes(keyword))) {
                            items.push({
                                description: description.trim(),
                                quantity: 1,
                                unitPrice: amount,
                                amount: amount,
                                lineNumber: items.length + 1
                            });
                        }
                    }
                }
            }
        }

        console.log(`📦 Extracted ${items.length} line items from tables`);
        return items;
    }

    // Extract text from table cell (simplified)
    extractTextFromCell(cell) {
        if (!cell || !cell.layout || !cell.layout.textAnchor) return '';
        return cell.layout.textAnchor.content || '';
    }

    // Helper methods
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff'
        };
        return mimeTypes[ext] || 'application/pdf';
    }

    formatDate(dateString) {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toISOString().split('T')[0];
        } catch {
            return dateString;
        }
    }

    parseAmount(amountString) {
        if (!amountString) return null;
        const cleaned = amountString.replace(/[^\d.,]/g, '');
        const number = parseFloat(cleaned.replace(/,/g, ''));
        return isNaN(number) ? null : number;
    }
}

module.exports = {
    GoogleDocumentAIProcessor
};