// backend/utils/google-document-ai.js
// Enhanced version with comprehensive line item extraction

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

    // CRITICAL FIX: Update the main parsing method to ensure items are properly added
    parseDocumentAIResponse(document) {
        console.log('🔍 Parsing Google Document AI response with comprehensive debugging...');

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
            items: [], // This will store the final items
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

        if (!document) {
            console.warn('⚠️ No document found in Document AI response');
            return result;
        }

        // Add comprehensive debugging
        console.log('📊 Document AI Response Structure:');
        console.log(`   Pages: ${document.pages?.length || 0}`);
        console.log(`   Entities: ${document.entities?.length || 0}`);
        console.log(`   Text length: ${document.text?.length || 0} characters`);

        let totalConfidence = 0;
        let entityCount = 0;
        const lineItemEntities = [];
        const allEntities = [];

        // Process entities with detailed logging
        if (document.entities) {
            console.log('\n🏷️ Processing Document AI Entities:');

            for (const entity of document.entities) {
                const entityType = entity.type;
                const mentionText = entity.mentionText;
                const confidence = entity.confidence || 0;

                allEntities.push({
                    type: entityType,
                    text: mentionText,
                    confidence: confidence
                });

                totalConfidence += confidence;
                entityCount++;

                console.log(`   📋 ${entityType}: "${mentionText}" (${(confidence * 100).toFixed(1)}%)`);

                // Check for line item entities
                if (this.isLineItemEntity(entityType)) {
                    lineItemEntities.push({
                        type: entityType,
                        text: mentionText,
                        confidence: confidence,
                        pageAnchor: entity.pageAnchor
                    });
                    console.log(`   🎯 LINE ITEM ENTITY FOUND: ${entityType}`);
                }

                // Process standard entities
                this.processStandardEntity(entity, result);
            }

            console.log(`\n📈 Entity Summary: ${entityCount} total, ${lineItemEntities.length} line item entities`);
        }

        // CRITICAL: Initialize allExtractedItems array to collect from all methods
        let allExtractedItems = [];

        // Process pages with comprehensive table analysis
        if (document.pages && document.pages.length > 0) {
            console.log(`\n📄 Processing ${document.pages.length} page(s) for tables and line items`);

            for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
                const page = document.pages[pageIndex];
                console.log(`\n📄 Page ${pageIndex + 1}:`);

                // Debug page structure
                console.log(`   Tables: ${page.tables?.length || 0}`);
                console.log(`   Form Fields: ${page.formFields?.length || 0}`);
                console.log(`   Blocks: ${page.blocks?.length || 0}`);
                console.log(`   Paragraphs: ${page.paragraphs?.length || 0}`);

                // Extract line items using multiple methods
                const extractedItems = [];

                // Method 1: Enhanced table extraction with debugging
                const tableItems = this.extractLineItemsFromTablesWithDebug(page, document.text);
                extractedItems.push(...tableItems);

                // Method 2: Entity-based extraction (PRIORITY for your case)
                const entityItems = this.extractLineItemsFromEntities(lineItemEntities, page, document.text);
                extractedItems.push(...entityItems);

                // Method 3: Text pattern extraction (fallback)
                const patternItems = this.extractLineItemsFromTextPatterns(page, document.text);
                extractedItems.push(...patternItems);

                // Method 4: Block-based extraction
                const blockItems = this.extractLineItemsFromBlocks(page, document.text);
                extractedItems.push(...blockItems);

                console.log(`   📦 Extracted ${extractedItems.length} items from page ${pageIndex + 1}`);

                // Add to master collection
                allExtractedItems.push(...extractedItems);
            }
        }

        // CRITICAL FIX: Process line item entities even if no pages
        if (lineItemEntities.length > 0 && allExtractedItems.length === 0) {
            console.log('\n🔧 FALLBACK: Processing line item entities directly...');
            const directEntityItems = this.extractLineItemsFromEntities(lineItemEntities, null, document.text);
            allExtractedItems.push(...directEntityItems);
        }

        // Combine and validate items
        const validItems = this.validateAndCleanItems(allExtractedItems);

        // CRITICAL: Ensure items are properly assigned
        result.items = validItems;

        console.log(`   📦 Total extracted items: ${allExtractedItems.length}`);
        console.log(`   ✅ Valid items after filtering: ${validItems.length}`);

        // Calculate confidence
        result.confidence = entityCount > 0 ? (totalConfidence / entityCount) * 100 : 0;

        console.log(`\n✅ Final extraction results:`);
        console.log(`   📦 Total Line Items: ${result.items.length}`);
        console.log(`   📊 Overall Confidence: ${result.confidence.toFixed(1)}%`);

        if (result.items.length > 0) {
            console.log(`   💰 Items total: ${result.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0).toFixed(2)}`);
            console.log(`   📦 Line items summary:`);
            result.items.forEach((item, index) => {
                console.log(`     ${index + 1}. ${item.description} - Qty: ${item.qtyShipped || item.unitQtyOrdered || 0} - ${item.lineTotal || 0}`);
            });
        }

        // If no items found, run diagnostic
        if (result.items.length === 0) {
            this.runLineItemDiagnostic(document, allEntities);
        }

        return result;
    }

    // Enhanced table extraction with comprehensive debugging
    extractLineItemsFromTablesWithDebug(page, fullText) {
        const items = [];

        if (!page.tables || page.tables.length === 0) {
            console.log('   ⚠️ No tables found on this page');
            return items;
        }

        console.log(`   📊 Analyzing ${page.tables.length} table(s):`);

        for (let tableIndex = 0; tableIndex < page.tables.length; tableIndex++) {
            const table = page.tables[tableIndex];
            console.log(`\n   📋 Table ${tableIndex + 1}:`);
            console.log(`     Header rows: ${table.headerRows?.length || 0}`);
            console.log(`     Body rows: ${table.bodyRows?.length || 0}`);

            if (!table.bodyRows || table.bodyRows.length === 0) {
                console.log('     ⚠️ Table has no body rows, skipping');
                continue;
            }

            // Analyze table structure
            const structure = this.analyzeTableStructureWithDebug(table, fullText);
            console.log(`     📝 Table analysis:`, structure);

            if (!structure.isLineItemTable) {
                console.log('     ⏭️ Not identified as a line item table, but extracting anyway for debugging');
            }

            // Extract all rows for debugging
            console.log(`     📄 Extracting from ${table.bodyRows.length} rows:`);

            for (let rowIndex = 0; rowIndex < table.bodyRows.length; rowIndex++) {
                const row = table.bodyRows[rowIndex];

                if (!row.cells || row.cells.length === 0) {
                    console.log(`       Row ${rowIndex + 1}: No cells`);
                    continue;
                }

                console.log(`       Row ${rowIndex + 1} (${row.cells.length} cells):`);

                // Debug each cell
                const cellContents = [];
                for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
                    const cellText = this.extractTextFromTableCellWithDebug(row.cells[cellIndex], fullText);
                    cellContents.push(cellText);
                    console.log(`         Cell ${cellIndex}: "${cellText}"`);
                }

                // Try to extract item from this row
                const item = this.extractItemFromTableRowWithDebug(row, structure, fullText, rowIndex, cellContents);

                if (item) {
                    console.log(`         ✅ Extracted item:`, item);
                    items.push(item);
                } else {
                    console.log(`         ❌ Could not extract valid item from this row`);
                }
            }
        }

        console.log(`   📊 Total items extracted from tables: ${items.length}`);
        return items;
    }

    // Enhanced table structure analysis with debugging
    analyzeTableStructureWithDebug(table, fullText) {
        const structure = {
            isLineItemTable: false,
            columnMapping: {},
            totalColumns: 0,
            confidence: 0
        };

        // Get header row or first row
        const headerRow = table.headerRows?.[0] || table.bodyRows?.[0];
        if (!headerRow || !headerRow.cells) {
            console.log('     ⚠️ No header row found');
            return structure;
        }

        structure.totalColumns = headerRow.cells.length;
        console.log(`     📊 Table has ${structure.totalColumns} columns`);

        // Enhanced column patterns for all fields
        const columnPatterns = {
            itemNumber: /^(item\s*number|item\s*#|part\s*number|part\s*#|sku|product\s*code|item\s*code)$/i,
            description: /^(description|item|product|service|details?|line\s*item|particulars|work\s*performed)$/i,
            customerPartNo: /^(customer\s*part\s*no|customer\s*part|cust\s*part|customer\s*#|part\s*ref)$/i,
            unitQtyOrdered: /^(unit\s*qty\s*ordered|qty\s*ordered|ordered\s*qty|order\s*qty|units?\s*ordered)$/i,
            qtyShipped: /^(qty\s*shipped|shipped\s*qty|quantity\s*shipped|delivered|qty\s*del)$/i,
            quantity: /^(qty|quantity|units?|amount|hours?|days?)$/i,
            unitPrice: /^(unit\s*price|price|rate|cost|unit\s*cost|unit\s*rate)$/i,
            netPrice: /^(net\s*price|net\s*amount|net\s*cost|net\s*rate|price\s*net)$/i,
            amount: /^(amount|total|line\s*total|extended|subtotal|sum|net\s*total)$/i,
            date: /^(date|period|from|to)$/i
        };

        // Analyze header cells
        console.log('     📝 Column analysis:');
        for (let colIndex = 0; colIndex < headerRow.cells.length; colIndex++) {
            const cellText = this.extractTextFromTableCellWithDebug(headerRow.cells[colIndex], fullText);
            console.log(`       Column ${colIndex}: "${cellText}"`);

            const cleanText = cellText.toLowerCase().trim();

            for (const [fieldName, pattern] of Object.entries(columnPatterns)) {
                if (pattern.test(cleanText)) {
                    structure.columnMapping[fieldName] = colIndex;
                    structure.isLineItemTable = true;
                    structure.confidence += 20;
                    console.log(`         ✅ Mapped as: ${fieldName}`);
                    break;
                }
            }
        }

        // If no clear mapping, try content-based detection
        if (!structure.isLineItemTable) {
            console.log('     🔍 No clear headers, analyzing content patterns...');
            structure.isLineItemTable = this.detectLineItemsByContentWithDebug(table.bodyRows, fullText);

            if (structure.isLineItemTable) {
                structure.columnMapping = this.createHeuristicColumnMapping(structure.totalColumns);
                structure.confidence = 40; // Lower confidence for heuristic mapping
                console.log('     📊 Using heuristic column mapping:', structure.columnMapping);
            }
        }

        return structure;
    }

    // Enhanced cell text extraction with debugging
    extractTextFromTableCellWithDebug(cell, fullText) {
        if (!cell) return '';

        let cellText = '';

        // Method 1: Layout text anchor
        if (cell.layout && cell.layout.textAnchor) {
            if (cell.layout.textAnchor.content) {
                cellText = cell.layout.textAnchor.content;
            } else if (cell.layout.textAnchor.textSegments && fullText) {
                cellText = cell.layout.textAnchor.textSegments
                    .map(segment => {
                        const startIndex = parseInt(segment.startIndex) || 0;
                        const endIndex = parseInt(segment.endIndex) || startIndex + 1;
                        return fullText.substring(startIndex, endIndex);
                    })
                    .join(' ');
            }
        }

        // Method 2: Direct text content
        if (!cellText && cell.text) {
            cellText = cell.text;
        }

        // Method 3: OCR text
        if (!cellText && cell.detectedText) {
            cellText = cell.detectedText;
        }

        return cellText.trim();
    }

    // Enhanced item extraction from table row with debugging - WITH ALL 8 FIELDS
    extractItemFromTableRowWithDebug(row, structure, fullText, rowIndex, cellContents) {
        const item = {
            itemNumber: null,
            description: '',
            customerPartNo: null,
            unitQtyOrdered: 0,
            qtyShipped: 0,
            unitPrice: 0,
            netPrice: 0,
            lineTotal: 0
        };

        const mapping = structure.columnMapping;

        // Extract based on column mapping
        if (mapping.itemNumber !== undefined && cellContents[mapping.itemNumber]) {
            item.itemNumber = cellContents[mapping.itemNumber].trim();
        }

        if (mapping.description !== undefined && cellContents[mapping.description]) {
            item.description = cellContents[mapping.description].trim();
        } else {
            // Fallback: use first non-numeric cell as description
            for (let i = 0; i < cellContents.length; i++) {
                const content = cellContents[i];
                if (content && content.length > 5 && !/^\$?[\d,]+\.?\d*$/.test(content)) {
                    item.description = content.trim();
                    break;
                }
            }
        }

        if (mapping.customerPartNo !== undefined && cellContents[mapping.customerPartNo]) {
            item.customerPartNo = cellContents[mapping.customerPartNo].trim();
        }

        if (mapping.unitQtyOrdered !== undefined && cellContents[mapping.unitQtyOrdered]) {
            item.unitQtyOrdered = this.parseQuantityWithDebug(cellContents[mapping.unitQtyOrdered]) || 0;
        } else if (mapping.quantity !== undefined && cellContents[mapping.quantity]) {
            // Fallback to regular quantity if unit qty ordered not found
            item.unitQtyOrdered = this.parseQuantityWithDebug(cellContents[mapping.quantity]) || 0;
        }

        if (mapping.qtyShipped !== undefined && cellContents[mapping.qtyShipped]) {
            item.qtyShipped = this.parseQuantityWithDebug(cellContents[mapping.qtyShipped]) || 0;
        }

        if (mapping.unitPrice !== undefined && cellContents[mapping.unitPrice]) {
            item.unitPrice = this.parseAmountWithDebug(cellContents[mapping.unitPrice]) || 0;
        }

        if (mapping.netPrice !== undefined && cellContents[mapping.netPrice]) {
            item.netPrice = this.parseAmountWithDebug(cellContents[mapping.netPrice]) || 0;
        }

        if (mapping.amount !== undefined && cellContents[mapping.amount]) {
            item.lineTotal = this.parseAmountWithDebug(cellContents[mapping.amount]) || 0;
        } else {
            // Fallback: use last numeric cell as line total
            for (let i = cellContents.length - 1; i >= 0; i--) {
                const amount = this.parseAmountWithDebug(cellContents[i]);
                if (amount && amount > 0) {
                    item.lineTotal = amount;
                    break;
                }
            }
        }

        // Calculate missing values
        if (item.lineTotal === 0 && item.qtyShipped > 0 && item.unitPrice > 0) {
            item.lineTotal = Math.round(item.qtyShipped * item.unitPrice * 100) / 100;
        } else if (item.lineTotal === 0 && item.unitQtyOrdered > 0 && item.unitPrice > 0) {
            item.lineTotal = Math.round(item.unitQtyOrdered * item.unitPrice * 100) / 100;
        }

        // Calculate net price if not provided
        if (item.netPrice === 0 && item.unitPrice > 0) {
            item.netPrice = item.unitPrice;
        }

        // Validate the item
        const isValid = this.isValidLineItemWithDebug(item);

        return isValid ? item : null;
    }

    // Enhanced amount parsing with debugging
    parseAmountWithDebug(text) {
        if (!text) return null;

        console.log(`         💰 Parsing amount: "${text}"`);

        // Remove currency symbols and clean
        const cleaned = text.replace(/[^\d.,\-]/g, '');
        console.log(`         💰 Cleaned: "${cleaned}"`);

        if (!cleaned) return null;

        // Handle different number formats
        let number;
        if (cleaned.includes(',') && cleaned.includes('.')) {
            // Format: 1,234.56
            number = parseFloat(cleaned.replace(/,/g, ''));
        } else if (cleaned.includes(',')) {
            // Could be 1,234 or 1,23 (European)
            const parts = cleaned.split(',');
            if (parts[parts.length - 1].length <= 2) {
                // European format: 1.234,56
                number = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
            } else {
                // US format: 1,234
                number = parseFloat(cleaned.replace(/,/g, ''));
            }
        } else {
            number = parseFloat(cleaned);
        }

        const result = !isNaN(number) && number >= 0 ? number : null;
        console.log(`         💰 Parsed result: ${result}`);

        return result;
    }

    // Enhanced quantity parsing with debugging
    parseQuantityWithDebug(text) {
        if (!text) return 1;

        console.log(`         📊 Parsing quantity: "${text}"`);

        const cleaned = text.replace(/[^\d.,]/g, '');
        const number = parseFloat(cleaned.replace(/,/g, ''));

        const result = !isNaN(number) && number > 0 ? number : 1;
        console.log(`         📊 Parsed quantity: ${result}`);

        return result;
    }

    isValidLineItemWithDebug(item) {
        // Always return true - trust Google Document AI
        console.log(`         ✅ Accepting line item from Google Document AI:`, {
            description: item.description,
            unitQtyOrdered: item.unitQtyOrdered,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal
        });

        return true;
    }



    // Create heuristic column mapping when headers aren't clear
    createHeuristicColumnMapping(columnCount) {
        const mapping = {};

        console.log(`     🎯 Creating heuristic mapping for ${columnCount} columns`);

        if (columnCount >= 8) {
            // Full format: Item#, Description, Customer Part, Qty Ordered, Qty Shipped, Unit Price, Net Price, Line Total
            mapping.itemNumber = 0;
            mapping.description = 1;
            mapping.customerPartNo = 2;
            mapping.unitQtyOrdered = 3;
            mapping.qtyShipped = 4;
            mapping.unitPrice = 5;
            mapping.netPrice = 6;
            mapping.amount = 7;
        } else if (columnCount >= 5) {
            // Partial format: Description, Qty, Unit Price, Net Price, Line Total
            mapping.description = 0;
            mapping.quantity = 1;
            mapping.unitPrice = 2;
            mapping.netPrice = 3;
            mapping.amount = 4;
        } else if (columnCount >= 4) {
            // Standard format: Description, Qty, Unit Price, Line Total
            mapping.description = 0;
            mapping.quantity = 1;
            mapping.unitPrice = 2;
            mapping.amount = 3;
        } else if (columnCount === 3) {
            // Basic format: Description, Qty/Price, Line Total
            mapping.description = 0;
            mapping.quantity = 1;
            mapping.amount = 2;
        } else if (columnCount === 2) {
            // Minimal format: Description, Line Total
            mapping.description = 0;
            mapping.amount = 1;
        }

        console.log(`     📝 Heuristic mapping:`, mapping);
        return mapping;
    }

    detectLineItemsByContentWithDebug(rows, fullText) {
        console.log('     🔍 Analyzing content patterns...');

        let itemLikeRows = 0;
        const sampleSize = Math.min(5, rows.length);

        for (let i = 0; i < sampleSize; i++) {
            const row = rows[i];
            if (!row.cells || row.cells.length < 2) continue;

            let hasDescription = false;
            let hasAmount = false;

            const rowData = [];
            for (const cell of row.cells) {
                const cellText = this.extractTextFromTableCellWithDebug(cell, fullText);
                rowData.push(cellText);

                // Check for description-like content
                if (cellText.length > 10 && /[a-zA-Z]/.test(cellText)) {
                    hasDescription = true;
                }

                // Check for amount-like content
                if (this.parseAmountWithDebug(cellText) > 0) {
                    hasAmount = true;
                }
            }

            console.log(`       Row ${i + 1}: [${rowData.join(' | ')}] - Desc: ${hasDescription}, Amount: ${hasAmount}`);

            if (hasDescription && hasAmount) {
                itemLikeRows++;
            }
        }

        const isLineItemTable = itemLikeRows >= Math.min(2, sampleSize);
        console.log(`     📊 Content analysis: ${itemLikeRows}/${sampleSize} rows look like line items = ${isLineItemTable}`);

        return isLineItemTable;
    }

    // Simple entity-based line item extraction - no filtering
    extractLineItemsFromEntities(lineItemEntities, page, fullText) {
        const items = [];

        if (lineItemEntities.length === 0) {
            console.log('   🏷️ No line item entities to process');
            return items;
        }

        console.log(`   🏷️ Processing ${lineItemEntities.length} line item entities`);

        for (const entity of lineItemEntities) {
            console.log(`   🔍 Processing line_item entity: "${entity.text}"`);
            const item = this.parseLineItemFromText(entity.text);
            if (item) {
                items.push(item);
                console.log('   ✅ Entity-based item:', item);
            }
        }

        return items;
    }

    // Simple parser for line item text - extract whatever is there
    parseLineItemFromText(text) {
        console.log(`   🔍 Parsing line item text: "${text}"`);

        if (!text) {
            return null;
        }

        const item = {
            itemNumber: null,
            description: text, // Default: use the whole text as description
            customerPartNo: null,
            unitQtyOrdered: 0,
            qtyShipped: 0,
            unitPrice: 0,
            netPrice: 0,
            lineTotal: 0
        };

        // Try to extract numbers from the text
        const numbers = text.match(/[\d,]+\.?\d*/g) || [];
        console.log(`   📊 Found numbers in text: ${numbers.join(', ')}`);

        if (numbers.length >= 2) {
            // Last number is usually the line total
            item.lineTotal = this.parseAmountSafe(numbers[numbers.length - 1]);

            // Second to last is usually unit price
            if (numbers.length >= 2) {
                item.unitPrice = this.parseAmountSafe(numbers[numbers.length - 2]);
                item.netPrice = item.unitPrice;
            }

            // First number might be quantity
            if (numbers.length >= 3) {
                const firstNum = this.parseAmountSafe(numbers[0]);
                if (firstNum > 0 && firstNum < 1000) { // Reasonable quantity range
                    item.unitQtyOrdered = firstNum;
                    item.qtyShipped = firstNum;
                }
            }
        }

        // Try to extract item number (alphanumeric codes)
        const itemNumMatch = text.match(/\b[A-Z0-9]{3,}\b/);
        if (itemNumMatch) {
            item.itemNumber = itemNumMatch[0];
        }

        // Try to extract a meaningful description
        let description = text;

        // Remove numbers from description
        description = description.replace(/[\d,]+\.?\d*/g, '').trim();

        // Remove common keywords
        description = description.replace(/\b(each|unit|per)\b/gi, '').trim();

        // Clean up extra spaces
        description = description.replace(/\s+/g, ' ').trim();

        if (description.length > 0) {
            item.description = description;
        }

        console.log(`   📊 Parsed item:`, item);
        return item;
    }


    // Simple amount parsing
    parseAmountSafe(text) {
        if (!text) return 0;

        const cleaned = text.replace(/[^\d.,]/g, '');
        if (!cleaned) return 0;

        const number = parseFloat(cleaned.replace(/,/g, ''));
        return !isNaN(number) && number >= 0 ? number : 0;
    }

    // Group line item entities that belong to the same item
    groupLineItemEntities(entities) {
        const groups = [];
        const processed = new Set();

        for (let i = 0; i < entities.length; i++) {
            if (processed.has(i)) continue;

            const group = [entities[i]];
            processed.add(i);

            // Find related entities (simple grouping for now)
            for (let j = i + 1; j < entities.length; j++) {
                if (processed.has(j)) continue;

                // Add to same group if they seem related
                if (this.areEntitiesRelated(entities[i], entities[j])) {
                    group.push(entities[j]);
                    processed.add(j);
                }
            }

            if (group.length > 0) {
                groups.push(group);
            }
        }

        return groups;
    }

    // Check if entities are related (belong to same line item)
    areEntitiesRelated(entity1, entity2) {
        // Simple check - you could enhance with position analysis
        if (!entity1.pageAnchor || !entity2.pageAnchor) return false;

        const page1 = entity1.pageAnchor.pageRefs?.[0]?.page;
        const page2 = entity2.pageAnchor.pageRefs?.[0]?.page;

        return page1 === page2;
    }

    // Create item from entity group with all 8 fields
    createItemFromEntityGroup(entityGroup) {
        const item = {
            itemNumber: null,
            description: '',
            customerPartNo: null,
            unitQtyOrdered: 0,
            qtyShipped: 0,
            unitPrice: 0,
            netPrice: 0,
            lineTotal: 0
        };

        for (const entity of entityGroup) {
            const entityType = entity.type.toLowerCase();

            if (entityType.includes('description') || entityType.includes('item')) {
                item.description = entity.text;
            } else if (entityType.includes('item_number') || entityType.includes('product_code')) {
                item.itemNumber = entity.text;
            } else if (entityType.includes('customer_part') || entityType.includes('part_no')) {
                item.customerPartNo = entity.text;
            } else if (entityType.includes('qty_ordered') || entityType.includes('quantity_ordered')) {
                item.unitQtyOrdered = this.parseQuantityWithDebug(entity.text) || 0;
            } else if (entityType.includes('qty_shipped') || entityType.includes('shipped')) {
                item.qtyShipped = this.parseQuantityWithDebug(entity.text) || 0;
            } else if (entityType.includes('quantity')) {
                // Fallback quantity mapping
                const qty = this.parseQuantityWithDebug(entity.text) || 0;
                if (item.unitQtyOrdered === 0) item.unitQtyOrdered = qty;
                if (item.qtyShipped === 0) item.qtyShipped = qty;
            } else if (entityType.includes('unit_price') || entityType.includes('price')) {
                item.unitPrice = this.parseAmountWithDebug(entity.text) || 0;
            } else if (entityType.includes('net_price')) {
                item.netPrice = this.parseAmountWithDebug(entity.text) || 0;
            } else if (entityType.includes('amount') || entityType.includes('total')) {
                item.lineTotal = this.parseAmountWithDebug(entity.text) || 0;
            }
        }

        // Calculate missing values
        if (item.lineTotal === 0 && item.qtyShipped > 0 && item.unitPrice > 0) {
            item.lineTotal = Math.round(item.qtyShipped * item.unitPrice * 100) / 100;
        } else if (item.lineTotal === 0 && item.unitQtyOrdered > 0 && item.unitPrice > 0) {
            item.lineTotal = Math.round(item.unitQtyOrdered * item.unitPrice * 100) / 100;
        }

        if (item.netPrice === 0 && item.unitPrice > 0) {
            item.netPrice = item.unitPrice;
        }

        return item;
    }

    // Disable pattern extraction - only use Google Document AI entities
    extractLineItemsFromTextPatterns(page, fullText) {
        console.log('   ⏭️ Skipping text pattern extraction - only using Google Document AI entities');
        return [];
    }

    // Create item from regex pattern match with all 8 fields
    createItemFromPatternMatch(match) {
        // This depends on which pattern matched
        if (match.length === 3) {
            // Simple description + lineTotal
            return {
                itemNumber: null,
                description: match[1].trim(),
                customerPartNo: null,
                unitQtyOrdered: 1,
                qtyShipped: 1,
                unitPrice: this.parseAmountWithDebug(match[2]) || 0,
                netPrice: this.parseAmountWithDebug(match[2]) || 0,
                lineTotal: this.parseAmountWithDebug(match[2]) || 0
            };
        } else if (match.length === 5) {
            // Qty + description + unit price + lineTotal
            return {
                itemNumber: null,
                description: match[2].trim(),
                customerPartNo: null,
                unitQtyOrdered: parseInt(match[1]) || 1,
                qtyShipped: parseInt(match[1]) || 1,
                unitPrice: this.parseAmountWithDebug(match[3]) || 0,
                netPrice: this.parseAmountWithDebug(match[3]) || 0,
                lineTotal: this.parseAmountWithDebug(match[4]) || 0
            };
        }

        return null;
    }

    // Disable block extraction - only use Google Document AI entities  
    extractLineItemsFromBlocks(page, fullText) {
        console.log('   ⏭️ Skipping block extraction - only using Google Document AI entities');
        return [];
    }

    // Simple validation - no filtering
    validateAndCleanItems(items) {
        const cleanItems = [];

        for (const item of items) {
            if (!item) continue;

            // Just clean up the item - no validation
            const cleanItem = {
                itemNumber: item.itemNumber || null,
                description: item.description || 'Line Item',
                customerPartNo: item.customerPartNo || null,
                unitQtyOrdered: Math.max(item.unitQtyOrdered || 0, 0),
                qtyShipped: Math.max(item.qtyShipped || 0, 0),
                unitPrice: Math.round((item.unitPrice || 0) * 100) / 100,
                netPrice: Math.round((item.netPrice || 0) * 100) / 100,
                lineTotal: Math.round((item.lineTotal || 0) * 100) / 100
            };

            cleanItems.push(cleanItem);
            console.log(`   ✅ Added clean item: ${cleanItem.description} - $${cleanItem.lineTotal}`);
        }

        return cleanItems;
    }

    // Run comprehensive diagnostic when no items found
    runLineItemDiagnostic(document, allEntities) {
        console.log('\n🔬 RUNNING LINE ITEM DIAGNOSTIC:');
        console.log('=====================================');

        // Check for line item entities
        const lineItemEntityTypes = allEntities.filter(e =>
            e.type.toLowerCase().includes('line') ||
            e.type.toLowerCase().includes('item') ||
            e.type.toLowerCase().includes('product')
        );

        console.log(`📋 Line item related entities: ${lineItemEntityTypes.length}`);
        lineItemEntityTypes.forEach(e => console.log(`   - ${e.type}: "${e.text}"`));

        // Check raw text for patterns
        if (document.text) {
            const text = document.text;
            console.log(`📝 Full text length: ${text.length} characters`);

            // Look for dollar amounts
            const dollarMatches = text.match(/\$[\d,]+\.?\d*/g) || [];
            console.log(`💰 Dollar amounts found: ${dollarMatches.length}`);
            console.log(`   First few: ${dollarMatches.slice(0, 5).join(', ')}`);

            // Look for table-like structures
            const lines = text.split('\n');
            const tabularLines = lines.filter(line =>
                (line.match(/\s+/g) || []).length >= 2 &&
                line.match(/\$?[\d,]+\.?\d*/g)
            );
            console.log(`📊 Potential table lines: ${tabularLines.length}`);
            tabularLines.slice(0, 3).forEach((line, i) =>
                console.log(`   ${i + 1}: "${line.trim()}"`));
        }

        // Check table structure
        if (document.pages) {
            let totalTables = 0;
            let totalCells = 0;

            document.pages.forEach((page, pageIndex) => {
                if (page.tables) {
                    totalTables += page.tables.length;
                    page.tables.forEach((table, tableIndex) => {
                        const cellCount = (table.bodyRows || []).reduce((sum, row) =>
                            sum + (row.cells || []).length, 0);
                        totalCells += cellCount;

                        console.log(`📋 Page ${pageIndex + 1}, Table ${tableIndex + 1}: ${cellCount} cells`);
                    });
                }
            });

            console.log(`📊 Total tables: ${totalTables}, Total cells: ${totalCells}`);
        }

        console.log('=====================================');
    }

    // Simple line item entity detection
    isLineItemEntity(entityType) {
        return entityType.toLowerCase() === 'line_item';
    }

    processStandardEntity(entity, result) {
        const entityType = entity.type;
        const mentionText = entity.mentionText;

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
        }
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