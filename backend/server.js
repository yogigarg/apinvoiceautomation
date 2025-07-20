// server.js - Enhanced with ML Models and LLM for Invoice Processing
require('dotenv').config(); // ← This MUST be the very first line

// Debug environment variables immediately after loading
console.log('🔍 Checking environment variables at startup:');
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID || 'NOT_SET');
console.log('GOOGLE_DOCUMENT_AI_PROCESSOR_ID:', process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || 'NOT_SET');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT_SET');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const { createWorker } = require('tesseract.js');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const PDFParser = require('pdf-parse');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const crypto = require('crypto');
const Joi = require('joi');
const axios = require('axios');
const { processDocumentPure } = require('./utils/pure-pdf-processor.js');
// Add these imports at the top of your server.js file

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;
// Initialize enhanced processor AFTER environment variables are loaded
let enhancedProcessor;

// Add this function to initialize the processor after server setup
function initializeEnhancedProcessor() {
    try {
        const { EnhancedDocumentProcessor } = require('./utils/enhanced-document-processor');
        enhancedProcessor = new EnhancedDocumentProcessor();
        console.log('✅ Enhanced Document Processor initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Enhanced Document Processor:', error.message);
        // Fallback: you can still use basic processing
    }
}


// Enhanced middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "http://localhost:5000"],
            // CRITICAL: Allow frame embedding from frontend
            frameAncestors: ["'self'", "http://localhost:3000", "http://localhost:3001"],
            frameSrc: ["'self'", "blob:", "data:", "http://localhost:5000"],
            objectSrc: ["'self'", "blob:", "data:", "http://localhost:5000"],
            // Allow worker scripts for PDF processing
            workerSrc: ["'self'", "blob:", "data:"],
            mediaSrc: ["'self'", "blob:", "data:"]
        },
    },
    // CRITICAL: Disable X-Frame-Options to prevent conflicts with CSP
    frameguard: false,
    // Allow cross-origin embedding
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP'
});
app.use(limiter);

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'customer_registration',
    password: String(process.env.DB_PASSWORD),
    port: process.env.DB_PORT || 5432,
});

// In-memory storage
const documents = new Map();
const processingQueue = new Map();

// LLM Configuration
const LLM_CONFIG = {
    // OpenAI GPT Configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini', // Cost-effective model
        endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    // Claude Configuration (via Anthropic API)
    claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307', // Fast and cost-effective
        endpoint: 'https://api.anthropic.com/v1/messages'
    },
    // Local LLM Configuration (Ollama)
    ollama: {
        endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
        model: 'llama3.1:8b' // Local model
    }
};

// In your main server file
const {
    enhancedPreprocessImage,
    performEnhancedOCR,
    enhancedRegexExtraction,
    createEnhancedLLMPrompt,
    postProcessOCRText
} = require('./utils/enhanced-ocr-extraction');

// Authentication middleware (keeping existing)
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query(
            'SELECT id, email, first_name, last_name, role, status, company_id FROM users WHERE id = $1 AND status = $2',
            [decoded.userId, 'active']
        );

        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'User not found or inactive' });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|tiff|tif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, JPEG, PNG, and TIFF files are allowed'));
        }
    }
});

// Utility functions
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);

    return {
        isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas,
        requirements: {
            minLength: password.length >= minLength,
            hasUpperCase,
            hasLowerCase,
            hasNumbers,
            hasSpecialChar: hasNonalphas
        }
    };
};

// Helper function to detect changes between original and updated data
function detectChanges(original, updated) {
    const changes = {};

    function compareObjects(obj1, obj2, path = '') {
        for (const key in obj2) {
            const currentPath = path ? `${path}.${key}` : key;

            if (obj2[key] !== null && typeof obj2[key] === 'object' && !Array.isArray(obj2[key])) {
                // Recursively compare nested objects
                compareObjects(obj1?.[key] || {}, obj2[key], currentPath);
            } else {
                // Compare primitive values
                const oldValue = obj1?.[key];
                const newValue = obj2[key];

                if (oldValue !== newValue) {
                    changes[currentPath] = {
                        from: oldValue,
                        to: newValue
                    };
                }
            }
        }
    }

    compareObjects(original || {}, updated);
    return changes;
}

// Helper function to calculate data completeness
function calculateDataCompleteness(invoiceData) {
    if (!invoiceData) return 0;

    const fields = [
        'invoiceNumber',
        'date',
        'vendor.name',
        'amounts.total'
    ];

    const optionalFields = [
        'dueDate',
        'vendor.phone',
        'vendor.email',
        'vendor.address',
        'amounts.subtotal',
        'amounts.tax',
        'amounts.taxRate'
    ];

    let requiredFieldsCount = 0;
    let optionalFieldsCount = 0;

    // Check required fields
    fields.forEach(field => {
        if (getNestedValue(invoiceData, field)) {
            requiredFieldsCount++;
        }
    });

    // Check optional fields
    optionalFields.forEach(field => {
        if (getNestedValue(invoiceData, field)) {
            optionalFieldsCount++;
        }
    });

    // Calculate completeness: required fields are weighted more heavily
    const requiredWeight = 0.7;
    const optionalWeight = 0.3;

    const requiredScore = (requiredFieldsCount / fields.length) * requiredWeight;
    const optionalScore = (optionalFieldsCount / optionalFields.length) * optionalWeight;

    return Math.round((requiredScore + optionalScore) * 100);
}

// Helper function to get nested object values
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

const sendEmail = async (email, subject, message) => {
    console.log('\n📧 EMAIL SENT:');
    console.log('To:', email);
    console.log('Subject:', subject);
    console.log('Message:', message);
    console.log('────────────────────────────────\n');
    return true;
};

async function preprocessImage(imagePath) {
    return await enhancedPreprocessImage(imagePath);
}

// Enhanced PDF processing with ML/LLM integration
async function processPDFDocument(pdfPath, documentId, socketId) {
    console.log(`📄 Processing PDF with enhanced ML/LLM: ${pdfPath}`);

    try {
        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'pdf_analysis',
            progress: 10,
            message: 'Analyzing PDF structure and content...'
        });

        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfData = await PDFParser(pdfBuffer);

        console.log(`📝 PDF contains ${pdfData.numpages} pages with ${pdfData.text.length} characters`);

        // More sophisticated text quality analysis
        const meaningfulText = pdfData.text.replace(/\s+/g, ' ').trim();
        const wordCount = meaningfulText.split(' ').length;
        const hasGoodText = meaningfulText.length > 100 &&
            wordCount > 20 &&
            /[a-zA-Z]/.test(meaningfulText) &&
            // Check for typical invoice keywords
            /(?:invoice|bill|total|amount|date|vendor|customer)/i.test(meaningfulText);

        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'pdf_text_extraction',
            progress: 25,
            message: `PDF analysis complete. Text quality: ${hasGoodText ? 'Good' : 'Poor'}`
        });

        if (hasGoodText) {
            console.log('✅ PDF has high-quality extractable text, using direct extraction + LLM enhancement');

            // Post-process the extracted text
            const cleanedText = postProcessOCRText(pdfData.text);

            return {
                text: cleanedText,
                confidence: 95,
                pageCount: pdfData.numpages || 1,
                method: 'direct_extraction',
                wordCount: wordCount
            };
        }

        console.log('⚠️ PDF appears to be image-based or low quality, using enhanced OCR + ML analysis');
        return await processPDFWithEnhancedOCR(pdfPath, documentId, socketId);

    } catch (error) {
        console.error('PDF processing failed:', error);
        throw new Error(`PDF processing failed: ${error.message}`);
    }
}

// Enhanced PDF OCR processing
async function processPDFWithEnhancedOCR(pdfPath, documentId, socketId) {
    try {
        const outputDir = path.join(path.dirname(pdfPath), `pdf_pages_${documentId}`);
        await fs.mkdir(outputDir, { recursive: true });

        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'pdf_conversion',
            progress: 30,
            message: 'Converting PDF to high-resolution images for enhanced OCR...'
        });

        // Enhanced PDF to image conversion settings
        const convert = pdf2pic.fromPath(pdfPath, {
            density: 400, // Increased DPI for better OCR
            saveFilename: "page",
            savePath: outputDir,
            format: "png",
            width: 3300, // Higher resolution
            height: 4680,
            quality: 100
        });

        const pages = await convert.bulk(-1, { responseType: "path" });
        console.log(`📄 Converted ${pages.length} PDF pages to high-resolution images`);

        if (pages.length === 0) {
            throw new Error('No pages could be converted from PDF');
        }

        let allText = '';
        let totalConfidence = 0;
        let validPages = 0;
        let allOcrDetails = [];

        for (let i = 0; i < pages.length; i++) {
            const pageInfo = pages[i];
            const pageNumber = i + 1;

            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'enhanced_ocr',
                progress: 40 + (i / pages.length) * 45,
                message: `Enhanced OCR processing page ${pageNumber} of ${pages.length}...`
            });

            try {
                // Use enhanced preprocessing
                const preprocessedPath = await enhancedPreprocessImage(pageInfo.path);

                // Use enhanced OCR with multiple PSM modes
                const ocrResult = await performEnhancedOCR(preprocessedPath, documentId, socketId, pageNumber);

                if (ocrResult.text && ocrResult.text.trim().length > 10) {
                    allText += `\n--- Page ${pageNumber} ---\n${ocrResult.text}\n`;
                    totalConfidence += ocrResult.confidence;
                    validPages++;

                    allOcrDetails.push({
                        page: pageNumber,
                        confidence: ocrResult.confidence,
                        mode: ocrResult.mode,
                        wordCount: ocrResult.words ? ocrResult.words.length : 0,
                        textLength: ocrResult.text.length
                    });

                    console.log(`✅ Page ${pageNumber} enhanced OCR: ${ocrResult.confidence.toFixed(1)}% confidence (${ocrResult.mode} mode)`);
                } else {
                    console.log(`⚠️ Page ${pageNumber}: Insufficient text extracted`);
                }

                // Clean up preprocessed image
                try {
                    await fs.unlink(preprocessedPath);
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }

            } catch (pageError) {
                console.error(`❌ Failed to process page ${pageNumber}:`, pageError.message);
            }
        }

        // Cleanup temp directory
        try {
            await fs.rmdir(outputDir, { recursive: true });
        } catch (cleanupError) {
            console.warn('Failed to clean up temp directory:', cleanupError.message);
        }

        if (validPages === 0) {
            throw new Error('No pages could be processed successfully with enhanced OCR');
        }

        const averageConfidence = totalConfidence / validPages;

        console.log(`📊 Enhanced OCR Summary:`);
        console.log(`   Valid pages: ${validPages}/${pages.length}`);
        console.log(`   Average confidence: ${averageConfidence.toFixed(1)}%`);
        console.log(`   Total text length: ${allText.length} characters`);

        return {
            text: allText.trim(),
            confidence: averageConfidence,
            pageCount: pages.length,
            validPages: validPages,
            method: 'enhanced_ocr',
            ocrDetails: allOcrDetails
        };

    } catch (error) {
        console.error('Enhanced PDF OCR processing failed:', error);
        throw error;
    }
}

// Enhanced OCR with better settings
async function performOCROnImage(imagePath, documentId, socketId, pageNumber = 1) {
    return await performEnhancedOCR(imagePath, documentId, socketId, pageNumber);
}

// ==================== ML/LLM ENHANCEMENT FUNCTIONS ====================

// LLM-based data extraction using OpenAI GPT
async function extractWithOpenAI(text, documentId, socketId) {
    if (!LLM_CONFIG.openai.apiKey) {
        console.log('⚠️ OpenAI API key not configured, skipping GPT extraction');
        return null;
    }

    try {
        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'llm_processing',
            progress: 90,
            message: 'Enhancing extraction with GPT-4...'
        });

        const prompt = createEnhancedLLMPrompt(text);

        const response = await axios.post(LLM_CONFIG.openai.endpoint, {
            model: LLM_CONFIG.openai.model,
            messages: [
                {
                    role: "system",
                    content: "You are a precise invoice data extraction AI. Always return valid JSON with complete line item details."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 4000 // Increased for better line item extraction
        }, {
            headers: {
                'Authorization': `Bearer ${LLM_CONFIG.openai.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // Increased timeout
        });

        const extractedData = JSON.parse(response.data.choices[0].message.content);

        // Validate and enhance the extracted data
        const validatedData = validateAndEnhanceExtractedData(extractedData);

        console.log(`✅ OpenAI GPT extraction completed - found ${validatedData.items?.length || 0} line items`);
        return { ...validatedData, extractionMethod: 'openai_gpt' };

    } catch (error) {
        console.error('OpenAI extraction failed:', error.message);
        return null;
    }
}

// Claude-based extraction
async function extractWithClaude(text, documentId, socketId) {
    if (!LLM_CONFIG.claude.apiKey) {
        console.log('⚠️ Claude API key not configured, skipping Claude extraction');
        return null;
    }

    try {
        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'llm_processing',
            progress: 92,
            message: 'Cross-validating with Claude AI...'
        });

        const prompt = `Extract all invoice data from the following text and return as JSON:

${text}

Return comprehensive invoice data as JSON with fields: invoiceNumber, date, vendor details, billing details, amounts, items, etc.`;

        const response = await axios.post(LLM_CONFIG.claude.endpoint, {
            model: LLM_CONFIG.claude.model,
            max_tokens: 2000,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        }, {
            headers: {
                'x-api-key': LLM_CONFIG.claude.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }
        });

        const extractedData = JSON.parse(response.data.content[0].text);
        console.log('✅ Claude extraction completed');
        return { ...extractedData, extractionMethod: 'claude' };

    } catch (error) {
        console.error('Claude extraction failed:', error.message);
        return null;
    }
}

// Local LLM extraction using Ollama
async function extractWithOllama(text, documentId, socketId) {
    try {
        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'llm_processing',
            progress: 94,
            message: 'Processing with local LLM...'
        });

        const prompt = `Extract invoice data from this text and return as JSON:

${text}

Return JSON with: invoiceNumber, date, vendor, billTo, amounts (subtotal, tax, total), items array, etc.`;

        const response = await axios.post(`${LLM_CONFIG.ollama.endpoint}/api/generate`, {
            model: LLM_CONFIG.ollama.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.1,
                top_p: 0.9
            }
        });

        const extractedData = JSON.parse(response.data.response);
        console.log('✅ Ollama local LLM extraction completed');
        return { ...extractedData, extractionMethod: 'ollama_local' };

    } catch (error) {
        console.error('Ollama extraction failed:', error.message);
        return null;
    }
}

// Enhanced regex-based extraction (fallback)
function extractInvoiceDataEnhanced(text) {
    return enhancedRegexExtraction(text);
}

// Consensus-based data extraction using multiple methods
async function extractInvoiceDataWithML(text, documentId, socketId) {
    console.log('🤖 Starting ML/LLM-enhanced invoice data extraction...');

    const extractionResults = [];
    const extractionMethods = [];

    // Try OpenAI GPT extraction
    try {
        const openaiResult = await extractWithOpenAI(text, documentId, socketId);
        if (openaiResult) {
            extractionResults.push(openaiResult);
            extractionMethods.push('OpenAI GPT');
        }
    } catch (error) {
        console.log('OpenAI extraction skipped:', error.message);
    }

    // Try Claude extraction
    try {
        const claudeResult = await extractWithClaude(text, documentId, socketId);
        if (claudeResult) {
            extractionResults.push(claudeResult);
            extractionMethods.push('Claude');
        }
    } catch (error) {
        console.log('Claude extraction skipped:', error.message);
    }

    // Try local LLM extraction
    try {
        const ollamaResult = await extractWithOllama(text, documentId, socketId);
        if (ollamaResult) {
            extractionResults.push(ollamaResult);
            extractionMethods.push('Ollama Local');
        }
    } catch (error) {
        console.log('Ollama extraction skipped:', error.message);
    }

    // Always include enhanced regex as fallback
    const regexResult = extractInvoiceDataEnhanced(text);
    extractionResults.push(regexResult);
    extractionMethods.push('Enhanced Regex');

    io.to(socketId).emit('processing_update', {
        documentId,
        stage: 'data_consensus',
        progress: 96,
        message: 'Creating consensus from multiple extraction methods...'
    });

    // Create consensus result
    const consensusResult = createConsensusResult(extractionResults, extractionMethods);

    console.log(`✅ ML/LLM extraction completed using ${extractionMethods.length} methods: ${extractionMethods.join(', ')}`);

    return consensusResult;
}

// Create consensus from multiple extraction results
function createConsensusResult(results, methods) {
    const consensus = {
        invoiceNumber: null,
        date: null,
        dueDate: null,
        vendor: {
            name: null,
            address: null,
            phone: null,
            email: null,
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
            total: null,
            amountPaid: null,
            balanceDue: null,
            currency: null
        },
        items: [],
        paymentDetails: {
            method: null,
            terms: null
        },
        orderInfo: {
            orderNumber: null,
            orderDate: null
        },
        notes: null,
        extractionMethods: methods,
        confidence: 0,
        consensusScore: 0
    };

    // Helper function to get most common value
    const getMostCommon = (field, path = '') => {
        const values = results.map(r => {
            if (path) {
                return path.split('.').reduce((obj, key) => obj?.[key], r);
            }
            return r[field];
        }).filter(v => v !== null && v !== undefined && v !== '');

        if (values.length === 0) return null;

        const counts = {};
        values.forEach(v => {
            counts[v] = (counts[v] || 0) + 1;
        });

        const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return mostCommon ? mostCommon[0] : null;
    };

    // Extract consensus values
    consensus.invoiceNumber = getMostCommon('invoiceNumber');
    consensus.date = getMostCommon('date');
    consensus.dueDate = getMostCommon('dueDate');

    // Vendor information
    consensus.vendor.name = getMostCommon('vendor', 'vendor.name') || getMostCommon('vendor');
    consensus.vendor.address = getMostCommon('vendor', 'vendor.address');
    consensus.vendor.phone = getMostCommon('vendor', 'vendor.phone');
    consensus.vendor.email = getMostCommon('vendor', 'vendor.email');
    consensus.vendor.taxId = getMostCommon('vendor', 'vendor.taxId');

    // Bill to information
    consensus.billTo.name = getMostCommon('billTo', 'billTo.name');
    consensus.billTo.address = getMostCommon('billTo', 'billTo.address');
    consensus.billTo.phone = getMostCommon('billTo', 'billTo.phone');
    consensus.billTo.email = getMostCommon('billTo', 'billTo.email');

    // Amounts - use average for numerical values if multiple sources agree
    const getAverageAmount = (path) => {
        const values = results.map(r => {
            const val = path.split('.').reduce((obj, key) => obj?.[key], r);
            return typeof val === 'number' ? val : parseFloat(val);
        }).filter(v => !isNaN(v) && v > 0);

        if (values.length === 0) return null;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    };

    consensus.amounts.subtotal = getAverageAmount('amounts.subtotal') || getAverageAmount('subtotal');
    consensus.amounts.tax = getAverageAmount('amounts.tax') || getAverageAmount('tax');
    consensus.amounts.total = getAverageAmount('amounts.total') || getAverageAmount('total');
    consensus.amounts.amountPaid = getAverageAmount('amounts.amountPaid');
    consensus.amounts.balanceDue = getAverageAmount('amounts.balanceDue');
    consensus.amounts.taxRate = getMostCommon('amounts', 'amounts.taxRate') || getMostCommon('taxRate');
    consensus.amounts.currency = getMostCommon('amounts', 'amounts.currency') || getMostCommon('currency');

    // Order information
    consensus.orderInfo.orderNumber = getMostCommon('orderInfo', 'orderInfo.orderNumber') || getMostCommon('orderNumber');
    consensus.orderInfo.orderDate = getMostCommon('orderInfo', 'orderInfo.orderDate') || getMostCommon('orderDate');

    // Payment details
    consensus.paymentDetails.method = getMostCommon('paymentDetails', 'paymentDetails.method') || getMostCommon('paymentMethod');
    consensus.paymentDetails.terms = getMostCommon('paymentDetails', 'paymentDetails.terms') || getMostCommon('terms');

    // Items - take the most comprehensive items array
    const allItems = results.map(r => r.items).filter(items => Array.isArray(items) && items.length > 0);
    if (allItems.length > 0) {
        consensus.items = allItems.reduce((longest, current) =>
            current.length > longest.length ? current : longest, []);
    }

    // Notes
    consensus.notes = getMostCommon('notes');

    // Calculate consensus confidence
    const fieldCount = Object.keys(consensus).length;
    const extractedFields = Object.values(consensus).filter(v =>
        v !== null && v !== undefined && v !== '' &&
        (typeof v !== 'object' || (Array.isArray(v) && v.length > 0) || Object.keys(v).length > 0)
    ).length;

    consensus.confidence = Math.round((extractedFields / fieldCount) * 100);
    consensus.consensusScore = Math.round((methods.length / 4) * 100); // Max 4 methods

    return consensus;
}

// Save document to database (enhanced)
async function saveDocumentToDatabase(documentData, userId, companyId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'documents'
      );
    `);

        if (!tableExists.rows[0].exists) {
            console.warn('Documents table does not exist yet - skipping database save');
            return null;
        }

        const documentResult = await client.query(`
      INSERT INTO documents (
        id, user_id, company_id, original_name, filename, file_path, 
        file_size, mime_type, status, page_count, extracted_text,
        processing_started_at, processing_completed_at, extraction_methods
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
            documentData.id,
            userId,
            companyId,
            documentData.originalName,
            documentData.filename,
            documentData.filePath || 'unknown',
            documentData.size || 0,
            documentData.mimetype || 'unknown',
            documentData.status,
            documentData.pageCount || 0,
            documentData.extractedText || null,
            documentData.processingStartedAt || new Date().toISOString(),
            documentData.completedAt,
            JSON.stringify(documentData.extractionMethods || [])
        ]);

        await client.query('COMMIT');
        return documentResult.rows[0].id;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Async processing function using PURE PDF.js
async function processDocumentAsyncPure(filePath, documentId, socketId, originalName, userId = null, companyId = null) {
    try {
        console.log(`🚀 Starting PURE PDF.js processing for: ${originalName}`);

        // Send initial processing update
        if (socketId) {
            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'preprocessing',
                progress: 5,
                message: 'Starting document processing with pure PDF.js...'
            });
        }

        // Use the PURE PDF.js processing function (NO EXTERNAL TOOLS)
        const result = await processDocumentPure(filePath, documentId, socketId, io);

        // Create document record
        const documentRecord = {
            id: documentId,
            originalName: originalName,
            filename: path.basename(filePath),
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            extractedText: result.extractedText,
            invoiceData: result.invoiceData,
            metrics: result.metrics,
            extractionMethods: result.extractionMethods,
            userId: userId,      // ← ADD THIS
            companyId: companyId // ← ADD THIS
        };

        console.log(`📊 Processing Summary for ${originalName}:`);
        console.log(`   ✅ Invoice #: ${documentRecord.invoiceData?.invoiceNumber || 'Not found'}`);
        console.log(`   🏢 Vendor: ${documentRecord.invoiceData?.vendor?.name || 'Not found'}`);
        console.log(`   💰 Total: ${documentRecord.invoiceData?.amounts?.currency || ''}${documentRecord.invoiceData?.amounts?.total || 'Not found'}`);
        console.log(`   📦 Line Items: ${documentRecord.invoiceData?.line_item?.length || 0}`);
        console.log(`   ⏱️ Processing Time: ${(documentRecord.metrics?.processingTime / 1000).toFixed(1)}s`);
        console.log(`   📈 Data Score: ${documentRecord.metrics?.dataExtractionScore || 0}%`);

        // TODO: Save to database if you have one
        // await saveDocumentToDatabase(documentRecord);

        // Send completion notification
        if (socketId) {
            io.to(socketId).emit('processing_complete', {
                documentId,
                document: documentRecord
            });
        }

        console.log(`✅ Processing completed successfully for: ${originalName}`);

        // Clean up original file after successful processing
        setTimeout(async () => {
            try {
                await fs.unlink(filePath);
                console.log(`🗑️ Cleaned up original file: ${originalName}`);
            } catch (cleanupError) {
                console.error('File cleanup failed:', cleanupError.message);
            }
        }, 60000); // Clean up after 1 minute

    } catch (error) {
        console.error(`❌ Processing failed for ${originalName}:`, error);

        if (socketId) {
            io.to(socketId).emit('processing_error', {
                documentId,
                error: `Processing failed: ${error.message}`
            });
        }

        // Cleanup file on error
        try {
            await fs.unlink(filePath);
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError.message);
        }
    }
}

function validateAndEnhanceExtractedData(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    // Ensure all required structure exists
    const enhanced = {
        invoiceNumber: data.invoiceNumber || null,
        date: validateDate(data.date),
        dueDate: validateDate(data.dueDate),
        vendor: {
            name: data.vendor?.name || null,
            address: data.vendor?.address || null,
            phone: data.vendor?.phone || null,
            email: validateEmail(data.vendor?.email),
            website: data.vendor?.website || null,
            taxId: data.vendor?.taxId || null
        },
        billTo: {
            name: data.billTo?.name || null,
            address: data.billTo?.address || null,
            phone: data.billTo?.phone || null,
            email: validateEmail(data.billTo?.email)
        },
        amounts: {
            subtotal: validateAmount(data.amounts?.subtotal),
            tax: validateAmount(data.amounts?.tax),
            taxRate: data.amounts?.taxRate || null,
            discount: validateAmount(data.amounts?.discount),
            total: validateAmount(data.amounts?.total),
            amountPaid: validateAmount(data.amounts?.amountPaid),
            balanceDue: validateAmount(data.amounts?.balanceDue),
            currency: data.amounts?.currency || 'USD'
        },
        items: validateLineItems(data.items),
        paymentDetails: {
            method: data.paymentDetails?.method || null,
            terms: data.paymentDetails?.terms || null,
            bankDetails: data.paymentDetails?.bankDetails || null,
            instructions: data.paymentDetails?.instructions || null
        },
        orderInfo: {
            orderNumber: data.orderInfo?.orderNumber || null,
            orderDate: validateDate(data.orderInfo?.orderDate),
            reference: data.orderInfo?.reference || null
        },
        notes: data.notes || null,
        confidence: Math.min(100, Math.max(0, data.confidence || 0))
    };

    return enhanced;
}

function validateDate(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return null;
        return date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function validateEmail(email) {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? email : null;
}

function validateAmount(amount) {
    if (amount === null || amount === undefined) return null;
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0 ? num : null;
}

function validateLineItems(items) {
    if (!Array.isArray(items)) return [];

    return items.map(item => ({
        description: item.description || '',
        quantity: validateAmount(item.quantity) || 1,
        unitPrice: validateAmount(item.unitPrice) || 0,
        amount: validateAmount(item.amount) || 0,
        reference: item.reference || null,
        category: item.category || null
    })).filter(item =>
        item.description.length > 0 &&
        item.quantity > 0 &&
        item.amount >= 0
    );
}

// Replace your existing processDocumentAsyncWithUser function with this:
async function processDocumentAsyncWithUser(filePath, documentId, socketId, originalName, userId, companyId) {
    try {
        console.log(`🚀 Starting enhanced processing for user ${userId}: ${originalName}`);

        const document = documents.get(documentId);
        if (!document) {
            throw new Error('Document not found in memory 12');
        }

        // Send initial processing update
        if (socketId) {
            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'enhanced_processing',
                progress: 5,
                message: 'Starting enhanced document processing...'
            });
        }

        let result;

        // Use enhanced processor if available, otherwise fall back to pure PDF processing
        if (enhancedProcessor) {
            try {
                result = await enhancedProcessor.processDocument(filePath, documentId, socketId, io);
            } catch (enhancedError) {
                console.warn('⚠️ Enhanced processing failed, using fallback:', enhancedError.message);
                result = await processDocumentPure(filePath, documentId, socketId, io);
                result.extractionMethods = ['Pure PDF.js (Fallback)'];
                result.metrics = {
                    ...result.metrics,
                    method: 'Pure PDF.js (Fallback)'
                };
            }
        } else {
            console.log('🔄 Using pure PDF processing (enhanced processor not available)');
            result = await processDocumentPure(filePath, documentId, socketId, io);
            result.extractionMethods = ['Pure PDF.js'];
            result.metrics = {
                ...result.metrics,
                method: 'Pure PDF.js'
            };
        }

        // Update document record
        document.status = 'completed';
        document.completedAt = new Date().toISOString();
        document.extractedText = result.extractedText;
        document.invoiceData = result.invoiceData;
        document.metrics = result.metrics;
        document.extractionMethods = result.extractionMethods;
        document.pageCount = result.metrics?.pagesProcessed || 1;

        console.log(`📊 Enhanced Processing Summary for 12 ${originalName}:`);
        console.log(`   ✅ Method: ${result.metrics?.method || 'Unknown'}`);
        console.log(`   📊 Confidence: ${result.metrics?.confidence?.toFixed(1) || result.metrics?.averageConfidence?.toFixed(1) || 0}%`);
        console.log(`   📄 Invoice #: ${document.invoiceData?.invoiceNumber || 'Not found'}`);
        console.log(`   🏢 Vendor: ${document.invoiceData?.vendor?.name || 'Not found'}`);
        console.log(`   💰 Total: ${document.invoiceData?.amounts?.currency || ''}${document.invoiceData?.amounts?.total || 'Not found'}`);
        console.log(`   📦 Line Items: ${document.invoiceData?.line_items?.length || 0}`);
        console.log(`   ⏱️ Processing Time: ${(document.metrics?.processingTime / 1000).toFixed(1)}s`);

        // Send completion notification
        if (socketId) {
            io.to(socketId).emit('processing_complete', {
                documentId,
                document: document
            });
        }

        console.log(`✅ Enhanced processing completed successfully for: ${originalName}`);

        // Clean up original file after successful processing
        setTimeout(async () => {
            try {
                await fs.unlink(filePath);
                console.log(`🗑️ Cleaned up original file: ${originalName}`);
            } catch (cleanupError) {
                console.error('File cleanup failed:', cleanupError.message);
            }
        }, 60000); // Clean up after 1 minute

    } catch (error) {
        console.error(`❌ Enhanced processing failed for ${originalName}:`, error);

        // Update document status
        const document = documents.get(documentId);
        if (document) {
            document.status = 'failed';
            document.error = error.message;
            document.completedAt = new Date().toISOString();
        }

        if (socketId) {
            io.to(socketId).emit('processing_error', {
                documentId,
                error: `Enhanced processing failed: ${error.message}`
            });
        }

        // Cleanup file on error
        try {
            await fs.unlink(filePath);
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError.message);
        }
    }
}

// At the very END of your server.js file, AFTER the server.listen() call:
server.listen(PORT, () => {
    console.log('\n🤖 Enhanced ML/LLM Document Processing Server');
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'customer_registration'}`);
    console.log(`🌐 Frontend: http://localhost:3000`);
    // ... your existing console.log statements

    // Initialize enhanced processor AFTER server is running
    console.log('🔧 Initializing enhanced document processor...');
    setTimeout(() => {
        initializeEnhancedProcessor();
    }, 1000); // Wait 1 second to ensure everything is ready
});

// Main enhanced document processing function
async function processDocument(documentId, filePath, originalName, socketId, userId, companyId) {
    try {
        const document = documents.get(documentId);

        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'preprocessing',
            progress: 5,
            message: 'Starting enhanced ML/LLM document processing...'
        });

        const fileExtension = path.extname(filePath).toLowerCase();
        let extractedText = '';
        let confidence = 0;
        let pageCount = 1;
        let processingMethod = 'unknown';

        // Extract text (PDF or image)
        if (fileExtension === '.pdf') {
            const pdfResult = await processPDFDocument(filePath, documentId, socketId);
            extractedText = pdfResult.text;
            confidence = pdfResult.confidence;
            pageCount = pdfResult.pageCount;
            processingMethod = pdfResult.method;
        } else {
            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'image_processing',
                progress: 20,
                message: 'Processing image with enhanced OCR...'
            });

            const preprocessedPath = await preprocessImage(filePath);
            const ocrResult = await performOCROnImage(preprocessedPath, documentId, socketId);
            extractedText = ocrResult.text;
            confidence = ocrResult.confidence;
            processingMethod = 'image_ocr';
        }

        document.pageCount = pageCount;
        document.extractedText = extractedText;

        // Enhanced ML/LLM data extraction
        io.to(socketId).emit('processing_update', {
            documentId,
            stage: 'ml_extraction',
            progress: 85,
            message: 'Extracting invoice data with ML/LLM models...'
        });

        const invoiceData = await extractInvoiceDataWithML(extractedText, documentId, socketId);

        // Update document with results
        document.invoiceData = invoiceData;
        document.status = 'completed';
        document.completedAt = new Date().toISOString();
        document.processingMethod = processingMethod;
        document.extractionMethods = invoiceData.extractionMethods;

        // Enhanced metrics
        document.metrics = {
            averageConfidence: confidence,
            textLength: extractedText.length,
            pagesProcessed: pageCount,
            processingTime: Date.now() - new Date(document.createdAt).getTime(),
            processingMethod: processingMethod,
            extractionMethods: invoiceData.extractionMethods,
            dataExtractionScore: invoiceData.confidence,
            consensusScore: invoiceData.consensusScore,
            fieldsExtracted: countExtractedFields(invoiceData)
        };

        // Save to database
        try {
            await saveDocumentToDatabase(document, userId, companyId);
            console.log(`✅ Document saved to database: ${documentId}`);
        } catch (dbError) {
            console.warn('⚠️ Database save failed:', dbError.message);
        }

        // Update user processing count
        try {
            await pool.query(
                'UPDATE users SET documents_processed = documents_processed + 1 WHERE id = $1',
                [userId]
            );
        } catch (updateError) {
            console.warn('Failed to update user document count:', updateError.message);
        }

        io.to(socketId).emit('processing_complete', {
            documentId,
            progress: 100,
            message: 'Enhanced ML/LLM processing completed successfully!',
            document: document
        });

        console.log(`🎉 Enhanced document processing completed: ${originalName}`);
        console.log(`   Methods used: ${invoiceData.extractionMethods?.join(', ')}`);
        console.log(`   Confidence: ${confidence.toFixed(1)}%`);
        console.log(`   Data quality: ${invoiceData.confidence}%`);
        console.log(`   Consensus score: ${invoiceData.consensusScore}%`);

    } catch (error) {
        console.error('Processing error:', error);
        const document = documents.get(documentId);
        if (document) {
            document.status = 'failed';
            document.error = error.message;
        }

        io.to(socketId).emit('processing_error', {
            documentId,
            error: error.message
        });
    }
}

// Helper function to count extracted fields
function countExtractedFields(data) {
    let count = 0;

    const checkField = (value) => {
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    };

    // Count main fields
    if (checkField(data.invoiceNumber)) count++;
    if (checkField(data.date)) count++;
    if (checkField(data.dueDate)) count++;

    // Count vendor fields
    if (checkField(data.vendor?.name)) count++;
    if (checkField(data.vendor?.address)) count++;
    if (checkField(data.vendor?.phone)) count++;
    if (checkField(data.vendor?.email)) count++;

    // Count amount fields
    if (checkField(data.amounts?.total)) count++;
    if (checkField(data.amounts?.subtotal)) count++;
    if (checkField(data.amounts?.tax)) count++;

    // Count items
    if (checkField(data.items)) count++;

    return count;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ===============================
// USER MANAGEMENT ROUTES (Complete Set)
// ===============================

// Health check with ML/LLM status
app.get('/api/health', (req, res) => {
    const googleAIStatus = enhancedProcessor ? enhancedProcessor.getStatus() : null;

    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: 'localhost',
        features: [
            'user_management',
            'document_processing',
            'enhanced_pdf_ocr',
            googleAIStatus?.googleAI ? 'google_document_ai' : 'ocr_fallback'
        ],
        google_document_ai: {
            enabled: googleAIStatus?.googleAI || false,
            initialized: googleAIStatus?.initializationAttempted || false,
            error: googleAIStatus?.googleAIStatus?.error || null,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'configured' : 'missing',
            processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID ? 'configured' : 'missing',
            credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'missing'
        }
    });
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            companyName,
            companyDomain,
            termsAccepted
        } = req.body;

        if (!email || !password || !firstName || !lastName || !companyName || !termsAccepted) {
            return res.status(400).json({
                error: 'All required fields must be provided and terms must be accepted'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                requirements: passwordValidation.requirements
            });
        }

        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = generateSecureToken();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query('BEGIN');

        const companyResult = await client.query(
            'INSERT INTO companies (name, domain, trial_expires_at) VALUES ($1, $2, $3) RETURNING id',
            [companyName, companyDomain, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
        );
        const companyId = companyResult.rows[0].id;

        const userResult = await client.query(
            `INSERT INTO users (
                email, password, password_hash, first_name, last_name, phone, company_id, 
                email_verification_token, email_verification_expires, terms_accepted, 
                terms_accepted_at, role, status, created_at, updated_at, is_email_verified,
                documents_processed, onboarding_completed
            ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING id, email, first_name, last_name, role, status`,
            [
                email, passwordHash, firstName, lastName, phone, companyId,
                verificationToken, verificationExpires, termsAccepted, new Date(),
                'viewer', 'pending', new Date(), new Date(), false, 0, false
            ]
        );

        const newUser = userResult.rows[0];

        await client.query(
            'INSERT INTO trial_limitations (company_id) VALUES ($1)',
            [companyId]
        );

        await client.query('COMMIT');

        const verificationUrl = `http://localhost:3000/verify-email?token=${verificationToken}`;
        await sendEmail(
            email,
            'Verify Your Email Address',
            `Hi ${firstName}! Click here to verify: ${verificationUrl}`
        );

        console.log(`🎉 User registered: ${email}`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);

        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful! Check console for verification link.',
            requiresVerification: true,
            verificationUrl: verificationUrl,
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                status: newUser.status
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);

        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        if (error.code === '42703') {
            return res.status(500).json({
                error: 'Database schema error. Please run user management migrations first.'
            });
        }

        res.status(500).json({ error: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
});

// Email verification endpoint
app.post('/api/verify-email', async (req, res) => {
    const client = await pool.connect();

    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const userResult = await client.query(
            'SELECT id, email, first_name, last_name, role FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const user = userResult.rows[0];

        await client.query('BEGIN');

        await client.query(
            `UPDATE users 
             SET email_verification_token = NULL, 
                 email_verification_expires = NULL, 
                 is_email_verified = true,
                 status = 'active',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [user.id]
        );

        await client.query('COMMIT');

        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Email verified for: ${user.email}`);

        res.json({
            message: 'Email verified successfully!',
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: 'active'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Email verification failed. Please try again.' });
    } finally {
        client.release();
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query(
            `SELECT u.id, u.password_hash, u.is_email_verified, u.first_name, 
              u.last_name, u.company_id, u.role, u.status, c.subscription_type
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_email_verified) {
            return res.status(401).json({
                error: 'Please verify your email address before logging in',
                requiresVerification: true
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign(
            {
                userId: user.id,
                email: email,
                companyId: user.company_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`🔐 User logged in: ${email}`);

        res.json({
            token,
            user: {
                id: user.id,
                email: email,
                firstName: user.first_name,
                lastName: user.last_name,
                companyId: user.company_id,
                role: user.role,
                status: user.status,
                subscriptionType: user.subscription_type
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Get user profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query(`
      SELECT u.*, c.name as company_name, c.subscription_type
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
    `, [req.user.id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Count documents from memory storage
        const userDocuments = Array.from(documents.values()).filter(doc => doc.userId === req.user.id);
        const completedDocuments = userDocuments.filter(doc => doc.status === 'completed').length;

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            status: user.status,
            company: {
                id: user.company_id,
                name: user.company_name,
                subscriptionType: user.subscription_type
            },
            onboarding: {
                completed: user.onboarding_completed || completedDocuments > 0,
                completedAt: user.onboarding_completed_at,
                documentsProcessed: Math.max(user.documents_processed || 0, completedDocuments)
            },
            stats: {
                totalDocuments: userDocuments.length,
                completedDocuments: completedDocuments
            },
            createdAt: user.created_at,
            lastLogin: user.last_login
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Password strength check endpoint
app.post('/api/check-password-strength', async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const validation = validatePassword(password);

    res.json({
        isValid: validation.isValid,
        requirements: validation.requirements,
        strength: validation.isValid ? 'Strong' : 'Weak'
    });
});

// Localhost helper endpoint - manually verify email
app.post('/api/localhost/verify-user', async (req, res) => {
    try {
        const { email } = req.body;

        await pool.query(
            'UPDATE users SET is_email_verified = true, status = $1 WHERE email = $2',
            ['active', email]
        );

        console.log(`🔧 Manually verified user: ${email}`);
        res.json({ message: 'User verified successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

// Get company info endpoint
app.get('/api/company/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.company_id !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT c.*, tl.max_users, tl.max_projects, tl.max_storage_mb, tl.features_enabled
       FROM companies c
       LEFT JOIN trial_limitations tl ON c.id = tl.company_id
       WHERE c.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to get company information' });
    }
});

// Admin migration helper
app.post('/api/admin/migrate-users', async (req, res) => {
    try {
        await pool.query(`
          UPDATE users 
          SET 
            role = COALESCE(role, 'viewer'),
            status = CASE 
              WHEN is_email_verified = true THEN 'active'
              WHEN email_verification_token IS NOT NULL THEN 'pending'
              ELSE 'active'
            END,
            password = COALESCE(password, password_hash),
            created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
            documents_processed = COALESCE(documents_processed, 0),
            onboarding_completed = COALESCE(onboarding_completed, false)
          WHERE role IS NULL OR status IS NULL OR documents_processed IS NULL
        `);

        const result = await pool.query('SELECT COUNT(*) as migrated_users FROM users');

        res.json({
            message: 'User migration completed',
            migrated_users: result.rows[0].migrated_users
        });

    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: 'Migration failed: ' + error.message });
    }
});

// Debug token endpoint
app.post('/api/debug/token', (req, res) => {
    try {
        const { token } = req.body;

        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
        console.log('Token received:', token?.substring(0, 20) + '...');

        if (!process.env.JWT_SECRET) {
            return res.json({ error: 'JWT_SECRET not set in environment' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({
            valid: true,
            decoded: decoded,
            secretLength: process.env.JWT_SECRET.length
        });
    } catch (error) {
        res.json({
            valid: false,
            error: error.message,
            secretExists: !!process.env.JWT_SECRET
        });
    }
});

// Enhanced upload endpoint
app.post('/api/upload', authenticateToken, upload.single('document'), async (req, res) => {
    const socketId = req.body.socketId;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📁 File uploaded by user ${req.user.id}: ${req.file.originalname}`);

        const documentId = Date.now().toString();
        const filePath = req.file.path;

        // Create document record with user association
        const documentRecord = {
            id: documentId,
            originalName: req.file.originalname,
            filename: req.file.filename,
            filePath: filePath,
            fileSize: req.file.size,
            mimetype: req.file.mimetype,
            status: 'processing',
            createdAt: new Date().toISOString(),
            userId: req.user.id,
            companyId: req.user.company_id
        };

        // Store in memory with user association
        documents.set(documentId, documentRecord);

        // Send initial response
        res.json({
            message: 'File uploaded successfully, processing started',
            documentId: documentId,
            document: {
                id: documentId,
                originalName: req.file.originalname,
                status: 'processing',
                createdAt: documentRecord.createdAt
            }
        });

        // 🔥 CRITICAL FIX: Use enhanced processing with Google Document AI
        console.log('🤖 Starting enhanced processing with Google Document AI...');

        processDocumentAsyncWithUser(
            filePath,
            documentId,
            socketId,
            req.file.originalname,
            req.user.id,
            req.user.company_id
        ).catch(error => {
            console.error('Enhanced processing failed:', error);

            const doc = documents.get(documentId);
            if (doc) {
                doc.status = 'failed';
                doc.error = error.message;
                doc.completedAt = new Date().toISOString();
            }

            if (socketId) {
                io.to(socketId).emit('processing_error', {
                    documentId,
                    error: error.message
                });
            }
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get individual document by ID
app.get('/api/documents/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = documents.get(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (document.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Add field-specific confidence scores
        const fieldConfidence = {
            'invoiceNumber': (document.metrics?.averageConfidence || 0) * 0.95,
            'date': (document.metrics?.averageConfidence || 0) * 0.88,
            'dueDate': (document.metrics?.averageConfidence || 0) * 0.82,
            'vendor.name': (document.metrics?.averageConfidence || 0) * 0.92,
            'vendor.phone': (document.metrics?.averageConfidence || 0) * 0.85,
            'vendor.email': (document.metrics?.averageConfidence || 0) * 0.87,
            'vendor.address': (document.metrics?.averageConfidence || 0) * 0.80,
            'amounts.subtotal': (document.metrics?.averageConfidence || 0) * 0.90,
            'amounts.tax': (document.metrics?.averageConfidence || 0) * 0.88,
            'amounts.taxRate': (document.metrics?.averageConfidence || 0) * 0.85,
            'amounts.total': (document.metrics?.averageConfidence || 0) * 0.93,
            'amounts.balanceDue': (document.metrics?.averageConfidence || 0) * 0.89
        };

        const enhancedMetrics = {
            ...document.metrics,
            fieldConfidence: fieldConfidence
        };

        res.json({
            ...document,
            metrics: enhancedMetrics
        });

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ error: 'Failed to retrieve document' });
    }
});


// Get individual document by ID
// Update document data endpoint
app.put('/api/documents/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { invoiceData } = req.body;

        // Get document from in-memory storage
        const document = documents.get(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check if user has access to this document
        if (document.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate the invoice data structure
        if (!invoiceData || typeof invoiceData !== 'object') {
            return res.status(400).json({ error: 'Invalid invoice data provided' });
        }

        // Create backup of original data
        const originalData = document.invoiceData;

        // Update the document with new invoice data
        document.invoiceData = {
            ...document.invoiceData,
            ...invoiceData,
            // Add metadata about the edit
            lastEditedAt: new Date().toISOString(),
            editedBy: req.user.id,
            isManuallyEdited: true
        };

        // Update document status and completion time
        document.lastModified = new Date().toISOString();
        document.status = 'completed'; // Ensure it's marked as completed after editing

        // Log the changes for audit purposes
        const changes = detectChanges(originalData, document.invoiceData);
        console.log(`📝 Document ${documentId} edited by user ${req.user.id}:`);
        console.log('   Changes:', JSON.stringify(changes, null, 2));

        // Try to save to database if available
        try {
            const client = await pool.connect();

            // Check if documents table exists
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'documents'
                );
            `);

            if (tableExists.rows[0].exists) {
                // Update the database record
                await client.query(`
                    UPDATE documents 
                    SET 
                        invoice_data = $1,
                        last_modified = $2,
                        is_manually_edited = true,
                        edited_by = $3,
                        status = 'completed'
                    WHERE id = $4 AND user_id = $5
                `, [
                    JSON.stringify(document.invoiceData),
                    document.lastModified,
                    req.user.id,
                    documentId,
                    req.user.id
                ]);

                console.log(`✅ Document ${documentId} updated in database`);
            }

            client.release();
        } catch (dbError) {
            console.warn('⚠️ Database update failed, continuing with in-memory update:', dbError.message);
        }

        // Recalculate metrics if needed
        const updatedMetrics = {
            ...document.metrics,
            dataCompleteness: calculateDataCompleteness(document.invoiceData),
            manuallyEdited: true,
            lastEditedAt: new Date().toISOString()
        };

        document.metrics = updatedMetrics;

        // Return the updated document
        const responseDocument = {
            id: document.id,
            originalName: document.originalName,
            filename: document.filename,
            status: document.status,
            createdAt: document.createdAt,
            completedAt: document.completedAt,
            lastModified: document.lastModified,
            metrics: document.metrics,
            invoiceData: document.invoiceData,
            extractedText: document.extractedText,
            extractionMethods: document.extractionMethods,
            isManuallyEdited: true
        };

        res.json({
            message: 'Document updated successfully',
            document: responseDocument,
            changes: changes
        });

    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

// Enhanced documents list endpoint (update existing one)
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const { search, status } = req.query;

        console.log(`📋 Getting documents for user ${req.user.id}`);
        console.log(`📊 Total documents in memory: ${documents.size}`);

        let userDocuments = Array.from(documents.values())
            .filter(doc => {
                const hasUserId = doc.userId === req.user.id;
                console.log(`Document ${doc.id}: userId=${doc.userId}, matches=${hasUserId}`);
                return hasUserId;
            });

        console.log(`👤 User ${req.user.id} has ${userDocuments.length} documents`);

        // Apply filters
        if (status && status !== 'all') {
            userDocuments = userDocuments.filter(doc => doc.status === status);
        }

        if (search) {
            userDocuments = userDocuments.filter(doc =>
                doc.originalName.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Map to response format
        const responseDocuments = userDocuments.map(doc => ({
            id: doc.id,
            originalName: doc.originalName,
            filename: doc.filename,
            status: doc.status,
            createdAt: doc.createdAt,
            completedAt: doc.completedAt,
            pageCount: doc.pageCount || 1,
            metrics: doc.metrics || {
                averageConfidence: 0,
                processingTime: 0,
                pagesProcessed: 1
            },
            invoiceData: doc.invoiceData || {},
            extractedText: doc.extractedText || '',
            extractionMethods: doc.extractionMethods || []
        }));

        console.log(`📤 Returning ${responseDocuments.length} documents`);
        res.json(responseDocuments);

    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to retrieve documents' });
    }
});

app.get('/api/debug/documents', authenticateToken, async (req, res) => {
    try {
        const allDocuments = Array.from(documents.entries()).map(([id, doc]) => ({
            id,
            originalName: doc.originalName,
            userId: doc.userId,
            status: doc.status,
            createdAt: doc.createdAt
        }));

        const userDocuments = allDocuments.filter(doc => doc.userId === req.user.id);

        res.json({
            user: {
                id: req.user.id,
                email: req.user.email
            },
            totalDocuments: allDocuments.length,
            userDocuments: userDocuments.length,
            allDocuments: allDocuments,
            userSpecificDocuments: userDocuments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete document endpoint
app.delete('/api/documents/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = documents.get(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check if user has access to this document
        if (document.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Delete file from filesystem
        if (document.filePath) {
            try {
                await fs.unlink(document.filePath);
                console.log(`📁 Deleted file: ${document.filePath}`);
            } catch (fileError) {
                console.warn('Failed to delete file:', fileError.message);
            }
        }

        // Remove from memory storage
        documents.delete(documentId);

        // Update user document count
        try {
            await pool.query(
                'UPDATE users SET documents_processed = GREATEST(documents_processed - 1, 0) WHERE id = $1',
                [req.user.id]
            );
        } catch (updateError) {
            console.warn('Failed to update user document count:', updateError.message);
        }

        console.log(`🗑️ Document deleted: ${documentId}`);
        res.json({ message: 'Document deleted successfully' });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        console.log(`📊 Getting basic analytics for user ${req.user.id}`);

        const userDocuments = Array.from(documents.values())
            .filter(doc => doc.userId === req.user.id);

        const totalDocuments = userDocuments.length;
        const completedDocuments = userDocuments.filter(doc => doc.status === 'completed').length;
        const processingDocuments = userDocuments.filter(doc => doc.status === 'processing').length;
        const failedDocuments = userDocuments.filter(doc => doc.status === 'failed').length;

        // Calculate average confidence for completed documents
        const completedDocs = userDocuments.filter(doc => doc.status === 'completed' && doc.metrics);
        const avgConfidence = completedDocs.length > 0
            ? completedDocs.reduce((sum, doc) => sum + (doc.metrics?.averageConfidence || 0), 0) / completedDocs.length
            : 0;

        // Calculate average processing time
        const avgProcessingTime = completedDocs.length > 0
            ? completedDocs.reduce((sum, doc) => sum + (doc.metrics?.processingTime || 0), 0) / completedDocs.length / 1000
            : 0;

        // Get recent documents
        const recentDocuments = userDocuments
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(doc => ({
                id: doc.id,
                originalName: doc.originalName,
                status: doc.status,
                createdAt: doc.createdAt,
                vendor: doc.invoiceData?.vendor?.name || 'Unknown',
                amount: doc.invoiceData?.amounts?.total || 0,
                confidence: doc.metrics?.averageConfidence || 0
            }));

        const analytics = {
            summary: {
                totalDocuments,
                completedDocuments,
                processingDocuments,
                failedDocuments,
                averageConfidence: avgConfidence,
                averageProcessingTime: avgProcessingTime
            },
            recentDocuments: recentDocuments
        };

        console.log(`📈 Analytics summary: ${totalDocuments} total, ${completedDocuments} completed, ${processingDocuments} processing`);

        res.json(analytics);

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics data' });
    }
});

// 2. Enhanced analytics endpoint (keep existing one but fix it)
app.get('/api/analytics/enhanced-dashboard', authenticateToken, async (req, res) => {
    try {
        console.log(`📊 Getting enhanced analytics for user ${req.user.id}`);

        const userDocuments = Array.from(documents.values())
            .filter(doc => doc.userId === req.user.id);

        const totalDocuments = userDocuments.length;
        const completedDocuments = userDocuments.filter(doc => doc.status === 'completed').length;
        const processingDocuments = userDocuments.filter(doc => doc.status === 'processing').length;
        const failedDocuments = userDocuments.filter(doc => doc.status === 'failed').length;

        const completedDocs = userDocuments.filter(doc => doc.status === 'completed' && doc.metrics);

        // Method usage statistics
        const methodStats = {};
        completedDocs.forEach(doc => {
            const method = doc.metrics?.method || doc.extractionMethods?.[0] || 'Unknown';
            methodStats[method] = (methodStats[method] || 0) + 1;
        });

        const avgConfidence = completedDocs.length > 0
            ? completedDocs.reduce((sum, doc) => sum + (doc.metrics?.confidence || doc.metrics?.averageConfidence || 0), 0) / completedDocs.length
            : 0;

        const avgProcessingTime = completedDocs.length > 0
            ? completedDocs.reduce((sum, doc) => sum + (doc.metrics?.processingTime || 0), 0) / completedDocs.length / 1000
            : 0;

        // Check if Google AI is enabled
        const googleAIEnabled = enhancedProcessor ? enhancedProcessor.getStatus().googleAI : false;

        res.json({
            summary: {
                totalDocuments,
                completedDocuments,
                processingDocuments,
                failedDocuments,
                averageConfidence: avgConfidence,
                averageProcessingTime: avgProcessingTime,
                methodUsage: methodStats,
                googleAIEnabled: googleAIEnabled
            },
            recentDocuments: userDocuments
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(doc => ({
                    id: doc.id,
                    originalName: doc.originalName,
                    status: doc.status,
                    createdAt: doc.createdAt,
                    method: doc.metrics?.method || doc.extractionMethods?.[0] || 'Unknown',
                    confidence: doc.metrics?.confidence || doc.metrics?.averageConfidence || 0,
                    vendor: doc.invoiceData?.vendor?.name || 'Unknown',
                    amount: doc.invoiceData?.amounts?.total || 0
                }))
        });
    } catch (error) {
        console.error('Enhanced analytics error:', error);
        res.status(500).json({ error: 'Failed to get enhanced analytics data' });
    }
});


// Test ML extraction endpoint
app.post('/api/test-extraction', authenticateToken, async (req, res) => {
    try {
        const { text, methods } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        console.log(`🧪 Testing extraction methods: ${methods?.join(', ') || 'all'}`);

        const results = {};

        // Test requested methods
        if (!methods || methods.includes('regex')) {
            results.regex = extractInvoiceDataEnhanced(text);
        }

        if (!methods || methods.includes('openai')) {
            results.openai = await extractWithOpenAI(text, 'test', null);
        }

        if (!methods || methods.includes('claude')) {
            results.claude = await extractWithClaude(text, 'test', null);
        }

        if (!methods || methods.includes('ollama')) {
            results.ollama = await extractWithOllama(text, 'test', null);
        }

        res.json({
            message: 'Extraction test completed',
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test extraction error:', error);
        res.status(500).json({ error: 'Test extraction failed' });
    }
});

// ===============================
// EXISTING USER MANAGEMENT ROUTES (keeping all existing routes)
// ===============================

// Registration endpoint (keeping existing)
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            companyName,
            companyDomain,
            termsAccepted
        } = req.body;

        if (!email || !password || !firstName || !lastName || !companyName || !termsAccepted) {
            return res.status(400).json({
                error: 'All required fields must be provided and terms must be accepted'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                requirements: passwordValidation.requirements
            });
        }

        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = generateSecureToken();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query('BEGIN');

        const companyResult = await client.query(
            'INSERT INTO companies (name, domain, trial_expires_at) VALUES ($1, $2, $3) RETURNING id',
            [companyName, companyDomain, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
        );
        const companyId = companyResult.rows[0].id;

        const userResult = await client.query(
            `INSERT INTO users (
                email, password, password_hash, first_name, last_name, phone, company_id, 
                email_verification_token, email_verification_expires, terms_accepted, 
                terms_accepted_at, role, status, created_at, updated_at, is_email_verified,
                documents_processed, onboarding_completed
            ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING id, email, first_name, last_name, role, status`,
            [
                email, passwordHash, firstName, lastName, phone, companyId,
                verificationToken, verificationExpires, termsAccepted, new Date(),
                'viewer', 'pending', new Date(), new Date(), false, 0, false
            ]
        );

        const newUser = userResult.rows[0];

        await client.query(
            'INSERT INTO trial_limitations (company_id) VALUES ($1)',
            [companyId]
        );

        await client.query('COMMIT');

        const verificationUrl = `http://localhost:3000/verify-email?token=${verificationToken}`;
        await sendEmail(
            email,
            'Verify Your Email Address',
            `Hi ${firstName}! Click here to verify: ${verificationUrl}`
        );

        console.log(`🎉 User registered: ${email}`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);

        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful! Check console for verification link.',
            requiresVerification: true,
            verificationUrl: verificationUrl,
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                status: newUser.status
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);

        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        if (error.code === '42703') {
            return res.status(500).json({
                error: 'Database schema error. Please run user management migrations first.'
            });
        }

        res.status(500).json({ error: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
});

// [Include all other existing routes: login, email verification, etc.]

// Special route for PDF files with relaxed CSP
app.get('/uploads/:filename', (req, res, next) => {
    const { filename } = req.params;

    // Check if it's a PDF file
    if (filename.toLowerCase().endsWith('.pdf')) {
        // Set headers specifically for PDF files
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');

        // Remove problematic headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');

        // Set permissive CSP for PDF files only
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self' data:; " +
            "frame-ancestors *; " +
            "object-src 'self';"
        );

        // Set additional headers for better PDF viewing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
    }

    // Continue to static file serving
    next();
}, express.static('uploads'));


// Get document edit history endpoint (optional)
app.get('/api/documents/:documentId/history', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        // This would typically come from a database table storing edit history
        // For now, return basic info about whether document was edited
        const document = documents.get(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (document.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const history = {
            documentId: documentId,
            isManuallyEdited: document.invoiceData?.isManuallyEdited || false,
            lastEditedAt: document.invoiceData?.lastEditedAt || null,
            editedBy: document.invoiceData?.editedBy || null,
            originalExtractionMethods: document.extractionMethods || [],
            currentDataCompleteness: calculateDataCompleteness(document.invoiceData)
        };

        res.json(history);

    } catch (error) {
        console.error('Get document history error:', error);
        res.status(500).json({ error: 'Failed to get document history' });
    }
});

// Bulk export endpoint for multiple documents
app.post('/api/documents/bulk-export', authenticateToken, async (req, res) => {
    try {
        const { documentIds, includeEditedData = true } = req.body;

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({ error: 'Document IDs array is required' });
        }

        const exportData = [];

        for (const documentId of documentIds) {
            const document = documents.get(documentId);

            if (document && document.userId === req.user.id) {
                exportData.push({
                    document: {
                        id: document.id,
                        originalName: document.originalName,
                        status: document.status,
                        createdAt: document.createdAt,
                        completedAt: document.completedAt,
                        lastModified: document.lastModified,
                        isManuallyEdited: document.invoiceData?.isManuallyEdited || false
                    },
                    invoiceData: includeEditedData ? document.invoiceData : document.originalInvoiceData || document.invoiceData,
                    metrics: document.metrics,
                    extractionMethods: document.extractionMethods
                });
            }
        }

        res.json({
            exportedAt: new Date().toISOString(),
            documentsCount: exportData.length,
            includeEditedData: includeEditedData,
            documents: exportData
        });

    } catch (error) {
        console.error('Bulk export error:', error);
        res.status(500).json({ error: 'Failed to export documents' });
    }
});


// Alternative PDF serving route with authentication
app.get('/api/pdf/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, 'uploads', filename);

        // Check if file exists and user has access
        const document = Array.from(documents.values()).find(doc =>
            doc.filename === filename && doc.userId === req.user.id
        );

        if (!document) {
            return res.status(404).json({ error: 'File not found or access denied' });
        }

        // Set PDF-friendly headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Send file
        res.sendFile(filePath);

    } catch (error) {
        console.error('PDF serve error:', error);
        res.status(500).json({ error: 'Failed to serve PDF' });
    }
});


// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

module.exports = app;