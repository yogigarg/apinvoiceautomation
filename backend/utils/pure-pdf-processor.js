// backend/utils/pure-pdf-processor.js
// Updated to use the singleton Tesseract manager

const fs = require('fs').promises;
const path = require('path');
const { createCanvas } = require('canvas');
const { tesseractManager } = require('./tesseract-manager');
const { enhancedRegexExtractionWithFixedItems, postProcessOCRText } = require('./enhanced-line-items-extraction');

// Alternative PDF text extraction using pure PDF.js
async function extractTextFromPdf(pdfPath) {
    try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        // Set up PDF.js for Node.js environment
        pdfjsLib.GlobalWorkerOptions.workerSrc = null;

        console.log(`📄 Extracting text from PDF: ${pdfPath}`);

        const data = new Uint8Array(await fs.readFile(pdfPath));
        const pdf = await pdfjsLib.getDocument({
            data: data,
            useSystemFonts: true,
            disableFontFace: false,
            verbosity: 0 // Reduce console output
        }).promise;

        let fullText = '';
        const pageTexts = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Better text extraction with positioning
                let pageText = '';
                let lastY = null;

                for (const item of textContent.items) {
                    // Add line breaks based on Y position changes
                    if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
                        pageText += '\n';
                    }

                    pageText += item.str;

                    // Add space if there's a significant gap in X position
                    if (item.hasEOL || (item.width && item.width > 0)) {
                        pageText += ' ';
                    }

                    lastY = item.transform[5];
                }

                pageTexts.push(pageText.trim());
                fullText += pageText + '\n\n';

                console.log(`📄 Page ${pageNum}: ${pageText.length} characters extracted`);

            } catch (pageError) {
                console.error(`❌ Error processing page ${pageNum}:`, pageError.message);
                pageTexts.push('');
            }
        }

        const cleanText = fullText.trim();
        console.log(`✅ PDF text extraction completed: ${cleanText.length} characters total`);

        return {
            text: cleanText,
            pageCount: pdf.numPages,
            pageTexts: pageTexts,
            hasText: cleanText.length > 50
        };

    } catch (error) {
        console.error('❌ PDF text extraction failed:', error);
        return {
            text: '',
            pageCount: 0,
            pageTexts: [],
            hasText: false
        };
    }
}

// Alternative: Convert PDF to images using PDF.js and Canvas (no GraphicsMagick)
async function convertPdfToImages(pdfPath, outputDir) {
    try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        // Set up for Node.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = null;

        console.log(`🖼️ Converting PDF to images using PDF.js + Canvas: ${pdfPath}`);

        const data = new Uint8Array(await fs.readFile(pdfPath));
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        await fs.mkdir(outputDir, { recursive: true });

        const imagePaths = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);

                // Set up canvas with high resolution
                const scale = 2.0; // High resolution for better OCR
                const viewport = page.getViewport({ scale });

                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // White background
                context.fillStyle = 'white';
                context.fillRect(0, 0, viewport.width, viewport.height);

                // Render PDF page to canvas
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Save canvas as PNG
                const imagePath = path.join(outputDir, `page-${pageNum}.png`);
                const buffer = canvas.toBuffer('image/png');
                await fs.writeFile(imagePath, buffer);

                imagePaths.push(imagePath);
                console.log(`✅ Page ${pageNum} converted to: ${imagePath}`);

            } catch (pageError) {
                console.error(`❌ Error converting page ${pageNum}:`, pageError.message);
            }
        }

        console.log(`✅ PDF conversion completed: ${imagePaths.length} images created`);
        return imagePaths;

    } catch (error) {
        console.error('❌ PDF to image conversion failed:', error);
        throw new Error(`PDF conversion failed: ${error.message}`);
    }
}

// Check if file is a PDF
function isPdfFile(filePath) {
    return path.extname(filePath).toLowerCase() === '.pdf';
}

// Clean up temporary files
async function cleanupFiles(filePaths) {
    const cleanupPromises = filePaths.map(async (filePath) => {
        try {
            await fs.unlink(filePath);
            console.log(`🗑️ Cleaned up: ${path.basename(filePath)}`);
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    await Promise.all(cleanupPromises);
}

// Enhanced OCR using the singleton Tesseract manager
async function performOCRWithManager(imagePath, documentId, socketId, pageNumber = 1) {
    try {
        console.log(`🔍 Performing OCR on page ${pageNumber} using Tesseract manager`);
        
        // Use the singleton Tesseract manager to avoid worker conflicts
        const result = await tesseractManager.performOCR(imagePath);
        
        console.log(`✅ OCR completed for page ${pageNumber}: ${result.confidence.toFixed(1)}% confidence`);
        
        return {
            text: result.text,
            confidence: result.confidence,
            words: result.words || [],
            lines: result.lines || []
        };
        
    } catch (error) {
        console.error(`❌ OCR failed for page ${pageNumber}:`, error);
        
        // Return empty result instead of throwing to continue processing
        return {
            text: '',
            confidence: 0,
            words: [],
            lines: []
        };
    }
}

// Main processing function - NO EXTERNAL DEPENDENCIES except Tesseract
async function processDocumentPure(filePath, documentId, socketId, io) {
    const startTime = Date.now();
    let imagePaths = [];
    let extractedText = '';
    let pageCount = 1;
    let metrics = {
        processingTime: 0,
        pagesProcessed: 1,
        averageConfidence: 0,
        dataExtractionScore: 0,
        consensusScore: 0
    };
    let extractionMethods = [];

    try {
        console.log(`🚀 Starting pure PDF.js processing: ${path.basename(filePath)}`);

        if (isPdfFile(filePath)) {
            console.log('📄 Processing PDF with pure PDF.js (no external tools)...');

            // Update progress
            if (io && socketId) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'pdf_text_extraction',
                    progress: 10,
                    message: 'Extracting text from PDF with PDF.js...'
                });
            }

            // Try to extract text directly from PDF first
            const textResult = await extractTextFromPdf(filePath);
            extractedText = textResult.text;
            pageCount = textResult.pageCount || 1;

            if (textResult.hasText) {
                console.log(`✅ Successfully extracted ${extractedText.length} characters from PDF`);
                extractionMethods.push('PDF.js Text Extraction');
                metrics.averageConfidence = 95; // High confidence for native PDF text
            } else {
                console.log('📄 PDF has minimal text, converting to images for OCR...');

                if (io && socketId) {
                    io.to(socketId).emit('processing_update', {
                        documentId,
                        stage: 'pdf_conversion',
                        progress: 20,
                        message: 'Converting PDF to images with PDF.js + Canvas...'
                    });
                }

                const outputDir = path.join(path.dirname(filePath), `${documentId}_pages`);
                imagePaths = await convertPdfToImages(filePath, outputDir);
                extractionMethods.push('PDF.js + Canvas Conversion');
            }

        } else {
            console.log('🖼️ Processing image file directly...');
            imagePaths = [filePath];
            extractionMethods.push('Direct Image Processing');
        }

        // If we need OCR (no good text from PDF or we have images)
        if ((!extractedText || extractedText.length < 50) && imagePaths.length > 0) {
            console.log('🔍 Using OCR for text extraction...');

            if (io && socketId) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'ocr_processing',
                    progress: 30,
                    message: 'Running OCR on document images...'
                });
            }

            let allOcrText = '';
            let totalConfidence = 0;
            let successfulPages = 0;

            for (let i = 0; i < imagePaths.length; i++) {
                const imagePath = imagePaths[i];
                console.log(`🔍 OCR processing page ${i + 1}/${imagePaths.length}`);

                try {
                    const ocrResult = await performOCRWithManager(imagePath, documentId, socketId, i + 1);
                    
                    if (ocrResult.text && ocrResult.text.length > 10) {
                        allOcrText += ocrResult.text + '\n';
                        totalConfidence += ocrResult.confidence;
                        successfulPages++;
                    }

                    if (io && socketId) {
                        io.to(socketId).emit('processing_update', {
                            documentId,
                            stage: 'ocr_processing',
                            progress: 30 + (i / imagePaths.length) * 40,
                            message: `OCR processing page ${i + 1}/${imagePaths.length}...`
                        });
                    }
                } catch (ocrError) {
                    console.error(`❌ OCR failed for page ${i + 1}:`, ocrError.message);
                }
            }

            extractedText = allOcrText.trim();
            metrics.averageConfidence = successfulPages > 0 ? totalConfidence / successfulPages : 0;
            extractionMethods.push('Enhanced OCR with Tesseract');
            
            console.log(`📊 OCR Summary: ${successfulPages}/${imagePaths.length} pages successful, avg confidence: ${metrics.averageConfidence.toFixed(1)}%`);
        }

        // Enhanced data extraction
        if (io && socketId) {
            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'data_extraction',
                progress: 80,
                message: 'Extracting invoice data with enhanced patterns...'
            });
        }

        console.log(`📝 Extracted text preview: ${extractedText.substring(0, 200)}...`);

        // Post-process the extracted text
        const cleanedText = postProcessOCRText(extractedText);
        
        // Use enhanced regex extraction with fixed line items
        const invoiceData = enhancedRegexExtractionWithFixedItems(cleanedText);
        extractionMethods.push('Enhanced Regex Extraction');

        // Calculate metrics
        const processingTime = Date.now() - startTime;
        metrics.processingTime = processingTime;
        metrics.pagesProcessed = pageCount;

        // Calculate data extraction score
        let dataScore = 0;
        if (invoiceData.invoiceNumber) dataScore += 20;
        if (invoiceData.date) dataScore += 15;
        if (invoiceData.vendor?.name) dataScore += 20;
        if (invoiceData.amounts?.total) dataScore += 25;
        if (invoiceData.items && invoiceData.items.length > 0) dataScore += 20;

        metrics.dataExtractionScore = dataScore;
        metrics.consensusScore = Math.min(95, (dataScore + metrics.averageConfidence) / 2);

        console.log(`✅ Processing completed in ${processingTime}ms`);
        console.log(`📊 Results: Confidence=${metrics.averageConfidence.toFixed(1)}%, Data Score=${metrics.dataExtractionScore}%`);
        console.log(`📋 Invoice #: ${invoiceData.invoiceNumber || 'Not found'}`);
        console.log(`🏢 Vendor: ${invoiceData.vendor?.name || 'Not found'}`);
        console.log(`💰 Total: ${invoiceData.amounts?.currency || ''}${invoiceData.amounts?.total || 'Not found'}`);
        console.log(`📦 Line Items: ${invoiceData.items?.length || 0} found`);

        return {
            extractedText: cleanedText,
            invoiceData,
            metrics,
            extractionMethods
        };

    } catch (error) {
        console.error('❌ Document processing failed:', error);
        throw new Error(`Document processing failed: ${error.message}`);
    } finally {
        // Cleanup temporary image files
        if (imagePaths.length > 0) {
            console.log('🗑️ Cleaning up temporary files...');
            await cleanupFiles(imagePaths);

            // Also cleanup the temporary directory
            const outputDir = path.join(path.dirname(filePath), `${documentId}_pages`);
            try {
                await fs.rmdir(outputDir);
                console.log(`🗑️ Cleaned up directory: ${outputDir}`);
            } catch (e) {
                // Ignore if directory doesn't exist or can't be removed
            }
        }
    }
}

module.exports = {
    extractTextFromPdf,
    convertPdfToImages,
    processDocumentPure,
    isPdfFile,
    cleanupFiles,
    performOCRWithManager
};