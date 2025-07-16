// backend/utils/tesseract-manager.js
// Singleton Tesseract worker manager to prevent worker conflicts

const Tesseract = require('tesseract.js');
const { createWorker } = require('tesseract.js');

class TesseractManager {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
        this.isInitializing = false;
        this.initPromise = null;
    }

    async getWorker() {
        if (this.isInitialized && this.worker) {
            return this.worker;
        }

        if (this.isInitializing) {
            return await this.initPromise;
        }

        this.isInitializing = true;
        this.initPromise = this.initializeWorker();
        
        try {
            await this.initPromise;
            return this.worker;
        } catch (error) {
            this.isInitializing = false;
            this.initPromise = null;
            throw error;
        }
    }

    async initializeWorker() {
        try {
            console.log('🔧 Initializing Tesseract worker...');

            // Terminate existing worker if any
            if (this.worker) {
                try {
                    await this.worker.terminate();
                } catch (e) {
                    console.warn('Warning: Could not terminate existing worker:', e.message);
                }
            }

            // Create new worker with proper configuration
            this.worker = await createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                errorHandler: err => {
                    console.error('Tesseract worker error:', err);
                },
                // Disable problematic features that can cause worker issues
                corePath: undefined,
                workerPath: undefined,
                workerBlobURL: false,
                gzip: false
            });

            // Configure worker parameters for better OCR
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!@#$%^&*()-_=+[]{}|;:\'",.<>?/~` \n\t',
                tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                preserve_interword_spaces: '1'
            });

            this.isInitialized = true;
            this.isInitializing = false;
            console.log('✅ Tesseract worker initialized successfully');

            return this.worker;

        } catch (error) {
            console.error('❌ Failed to initialize Tesseract worker:', error);
            this.isInitialized = false;
            this.isInitializing = false;
            this.worker = null;
            throw new Error(`Tesseract initialization failed: ${error.message}`);
        }
    }

    async performOCR(imagePath, options = {}) {
        try {
            const worker = await this.getWorker();
            
            console.log(`🔍 Performing OCR on: ${imagePath}`);
            
            const { data } = await worker.recognize(imagePath, {
                rectangle: options.rectangle,
                pageseg: options.pageseg || Tesseract.PSM.AUTO
            });

            const confidence = data.confidence || 0;
            const text = data.text || '';

            console.log(`📝 OCR completed - Confidence: ${confidence.toFixed(1)}%, Text length: ${text.length}`);

            return {
                text: text.trim(),
                confidence: confidence,
                words: data.words || [],
                lines: data.lines || [],
                paragraphs: data.paragraphs || []
            };

        } catch (error) {
            console.error('❌ OCR processing failed:', error);
            
            // Try to reinitialize worker on failure
            if (error.message.includes('worker') || error.message.includes('SetVariable')) {
                console.log('🔄 Attempting to reinitialize worker...');
                this.isInitialized = false;
                this.worker = null;
                
                try {
                    const worker = await this.getWorker();
                    return await this.performOCR(imagePath, options);
                } catch (retryError) {
                    throw new Error(`OCR failed after retry: ${retryError.message}`);
                }
            }
            
            throw new Error(`OCR processing failed: ${error.message}`);
        }
    }

    async cleanup() {
        if (this.worker) {
            try {
                console.log('🧹 Cleaning up Tesseract worker...');
                await this.worker.terminate();
                this.worker = null;
                this.isInitialized = false;
                console.log('✅ Tesseract worker terminated');
            } catch (error) {
                console.warn('Warning during worker cleanup:', error.message);
            }
        }
    }
}

// Create singleton instance
const tesseractManager = new TesseractManager();

// Cleanup on process exit
process.on('exit', () => {
    tesseractManager.cleanup();
});

process.on('SIGINT', async () => {
    await tesseractManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await tesseractManager.cleanup();
    process.exit(0);
});

module.exports = {
    tesseractManager,
    TesseractManager
};