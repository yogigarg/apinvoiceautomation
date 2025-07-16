// backend/utils/pdf-processor-alternative.js
// Alternative PDF processing without Ghostscript dependency

const fs = require('fs').promises;
const path = require('path');
const pdf2pic = require('pdf2pic');

// Alternative PDF to image conversion
async function convertPdfToImages(pdfPath, outputDir) {
    try {
        console.log(`🔄 Converting PDF to images using PDF.js: ${pdfPath}`);

        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        const convert = pdf2pic.fromPath(pdfPath, {
            density: 300,           // High resolution for better OCR
            saveFilename: "page",
            savePath: outputDir,
            format: "png",
            width: 2480,            // A4 size at 300 DPI
            height: 3508
        });

        // Convert all pages
        const results = await convert.bulk(-1); // -1 means all pages
        
        console.log(`✅ PDF converted successfully. ${results.length} pages processed.`);
        
        // Return array of image paths
        return results.map(result => result.path);
        
    } catch (error) {
        console.error('❌ PDF conversion failed with PDF.js:', error);
        throw new Error(`PDF conversion failed: ${error.message}`);
    }
}

// Alternative PDF text extraction using PDF.js
async function extractTextFromPdf(pdfPath) {
    try {
        // Import PDF.js in a way that works with Node.js
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        
        // Disable worker for Node.js environment
        pdfjsLib.GlobalWorkerOptions.workerSrc = null;
        
        console.log(`📄 Extracting text from PDF using PDF.js: ${pdfPath}`);
        
        const data = new Uint8Array(await fs.readFile(pdfPath));
        const pdf = await pdfjsLib.getDocument({
            data: data,
            useSystemFonts: true
        }).promise;
        
        let fullText = '';
        const textByPage = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Extract text with better formatting
                const pageText = textContent.items
                    .map(item => {
                        // Handle text positioning for better line breaks
                        if (item.hasEOL) {
                            return item.str + '\n';
                        }
                        return item.str + ' ';
                    })
                    .join('');
                
                textByPage.push(pageText);
                fullText += pageText + '\n\n';
                
                console.log(`📄 Page ${pageNum}: ${pageText.length} characters extracted`);
                
            } catch (pageError) {
                console.error(`❌ Error processing page ${pageNum}:`, pageError.message);
                textByPage.push('');
            }
        }
        
        console.log(`✅ Text extraction completed. ${fullText.length} characters total.`);
        
        return {
            text: fullText.trim(),
            pageCount: pdf.numPages,
            pageTexts: textByPage
        };
        
    } catch (error) {
        console.error('❌ PDF text extraction failed:', error);
        // Return empty result instead of throwing to allow OCR fallback
        return {
            text: '',
            pageCount: 0,
            pageTexts: []
        };
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
            console.log(`🗑️ Cleaned up: ${filePath}`);
        } catch (error) {
            // Ignore cleanup errors
            console.log(`⚠️ Could not cleanup ${filePath}: ${error.message}`);
        }
    });
    
    await Promise.all(cleanupPromises);
}

// Main processing function
async function processDocumentAlternative(filePath, documentId, socketId, io) {
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
        if (isPdfFile(filePath)) {
            console.log('📄 Processing PDF with PDF.js alternative...');
            
            // Update progress
            if (io && socketId) {
                io.to(socketId).emit('processing_update', {
                    documentId,
                    stage: 'pdf_text_extraction',
                    progress: 10,
                    message: 'Extracting text from PDF...'
                });
            }

            // Try to extract text directly from PDF first
            const textResult = await extractTextFromPdf(filePath);
            extractedText = textResult.text;
            pageCount = textResult.pageCount || 1;
            
            if (extractedText && extractedText.length > 50) {
                console.log(`✅ Successfully extracted ${extractedText.length} characters from PDF`);
                extractionMethods.push('PDF.js Text Extraction');
                metrics.averageConfidence = 95; // High confidence for native PDF text
            } else {
                console.log('📄 PDF text extraction yielded minimal text, preparing for OCR...');
            }

            // If text extraction didn't work well, convert to images for OCR
            if (!extractedText || extractedText.length < 50) {
                if (io && socketId) {
                    io.to(socketId).emit('processing_update', {
                        documentId,
                        stage: 'pdf_conversion',
                        progress: 20,
                        message: 'Converting PDF to images for OCR...'
                    });
                }

                const outputDir = path.join(path.dirname(filePath), `${documentId}_pages`);
                imagePaths = await convertPdfToImages(filePath, outputDir);
                extractionMethods.push('PDF.js Image Conversion');
            }
            
        } else {
            console.log('🖼️ Processing image file directly...');
            imagePaths = [filePath];
            extractionMethods.push('Direct Image Processing');
        }

        // If we have images and no good text, use OCR
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

            const { performEnhancedOCR } = require('./enhanced-ocr-extraction');
            
            let allOcrText = '';
            let totalConfidence = 0;
            
            for (let i = 0; i < imagePaths.length; i++) {
                const imagePath = imagePaths[i];
                console.log(`🔍 Processing page ${i + 1}/${imagePaths.length}`);
                
                try {
                    const ocrResult = await performEnhancedOCR(imagePath, documentId, socketId, i + 1);
                    allOcrText += ocrResult.text + '\n';
                    totalConfidence += ocrResult.confidence;
                    
                    if (io && socketId) {
                        io.to(socketId).emit('processing_update', {
                            documentId,
                            stage: 'ocr_processing',
                            progress: 30 + (i / imagePaths.length) * 30,
                            message: `OCR processing page ${i + 1}/${imagePaths.length}...`
                        });
                    }
                } catch (ocrError) {
                    console.error(`❌ OCR failed for page ${i + 1}:`, ocrError.message);
                }
            }
            
            extractedText = allOcrText.trim();
            metrics.averageConfidence = imagePaths.length > 0 ? totalConfidence / imagePaths.length : 0;
            extractionMethods.push('Enhanced OCR');
        }

        // Enhanced data extraction
        if (io && socketId) {
            io.to(socketId).emit('processing_update', {
                documentId,
                stage: 'data_extraction',
                progress: 70,
                message: 'Extracting invoice data...'
            });
        }

        const { enhancedRegexExtraction } = require('./enhanced-ocr-extraction');
        const invoiceData = enhancedRegexExtraction(extractedText);
        extractionMethods.push('Enhanced Regex Extraction');

        // Calculate metrics
        const processingTime = Date.now() - startTime;
        metrics.processingTime = processingTime;
        metrics.pagesProcessed = pageCount;
        
        // Calculate data extraction score based on how much data we found
        let dataScore = 0;
        if (invoiceData.invoiceNumber) dataScore += 20;
        if (invoiceData.date) dataScore += 15;
        if (invoiceData.vendor?.name) dataScore += 20;
        if (invoiceData.amounts?.total) dataScore += 25;
        if (invoiceData.items && invoiceData.items.length > 0) dataScore += 20;
        
        metrics.dataExtractionScore = dataScore;
        metrics.consensusScore = Math.min(95, (dataScore + metrics.averageConfidence) / 2);

        console.log(`✅ Document processing completed in ${processingTime}ms`);
        console.log(`📊 Metrics: Confidence=${metrics.averageConfidence}%, Data Score=${metrics.dataExtractionScore}%`);

        return {
            extractedText,
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
            } catch (e) {
                // Ignore if directory doesn't exist or can't be removed
            }
        }
    }
}

module.exports = {
    convertPdfToImages,
    extractTextFromPdf,
    processDocumentAlternative,
    isPdfFile,
    cleanupFiles
};