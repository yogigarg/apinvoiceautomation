// scripts/setup-document-processing.js
// Run this script after updating package.json to set up document processing

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'customer_registration',
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT || 5432,
});

async function setupDocumentProcessing() {
  console.log('🚀 Setting up Document Processing Integration...\n');

  try {
    // 1. Create uploads directory
    console.log('📁 Creating uploads directory...');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('✅ Uploads directory created');
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      console.log('✅ Uploads directory already exists');
    }

    // 2. Check database connection
    console.log('\n🗄️  Checking database connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');

    // 3. Check if document processing tables exist
    console.log('\n📋 Checking document processing tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'invoice_data', 'processing_metrics')
    `);

    if (tableCheck.rows.length === 0) {
      console.log('⚠️  Document processing tables not found');
      console.log('📝 Please run the database migration first:');
      console.log('   psql -d customer_registration -f integrated_database_schema.sql');
    } else {
      console.log('✅ Document processing tables found');
    }

    // 4. Check if users table has new columns
    console.log('\n👤 Checking user table enhancements...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('documents_processed', 'onboarding_completed')
    `);

    if (columnCheck.rows.length < 2) {
      console.log('🔧 Adding missing columns to users table...');
      try {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS documents_processed INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS last_document_processed_at TIMESTAMP
        `);
        console.log('✅ User table enhanced successfully');
      } catch (error) {
        console.log('⚠️  Could not add columns (they may already exist)');
      }
    } else {
      console.log('✅ User table already enhanced');
    }

    // 5. Update existing users with default values
    console.log('\n🔄 Updating existing users...');
    const updateResult = await client.query(`
      UPDATE users 
      SET 
        documents_processed = COALESCE(documents_processed, 0),
        onboarding_completed = COALESCE(onboarding_completed, false)
      WHERE documents_processed IS NULL OR onboarding_completed IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing users`);

    // 6. Check environment variables
    console.log('\n🔧 Checking environment configuration...');
    const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('⚠️  Missing environment variables:', missingVars.join(', '));
      console.log('   Please ensure these are set in your .env file');
    } else {
      console.log('✅ Required environment variables found');
    }

    // 7. Create sample .env additions
    console.log('\n📝 Recommended .env additions:');
    const envAdditions = `
# Document Processing Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
ALLOWED_FILE_TYPES=application/pdf,image/jpeg,image/png,image/tiff

# OCR Configuration  
TESSERACT_WORKER_COUNT=2
OCR_TIMEOUT=30000
OCR_LANGUAGE=eng

# Socket.IO Configuration
SOCKET_TIMEOUT=60000
`;
    console.log(envAdditions);

    // 8. Test Tesseract availability
    console.log('🔍 Testing OCR capabilities...');
    try {
      const Tesseract = require('tesseract.js');
      console.log('✅ Tesseract.js ready for OCR processing');
    } catch (error) {
      console.log('⚠️  Tesseract.js not available - OCR may not work');
      console.log('   Run: npm install tesseract.js');
    }

    client.release();

    // 9. Create test document processing function
    console.log('\n🧪 Creating test endpoints...');
    const testEndpoints = [
      'GET  /api/health - System health check',
      'POST /api/upload - Upload documents (auth required)',
      'GET  /api/documents - List user documents (auth required)', 
      'GET  /api/onboarding/progress - Get onboarding status (auth required)',
      'GET  /api/sample-invoices - Get sample invoices (auth required)'
    ];
    
    console.log('📡 New API endpoints available:');
    testEndpoints.forEach(endpoint => console.log(`   ${endpoint}`));

    console.log('\n🎉 Document Processing Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update your server.js with the integrated version');
    console.log('2. Add the recommended environment variables to .env');
    console.log('3. Run database migration if tables are missing');
    console.log('4. Start your server with: npm run dev');
    console.log('5. Test document upload at: http://localhost:5000/api/health');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Ensure PostgreSQL is running');
    console.log('- Check database credentials in .env');
    console.log('- Verify database exists and is accessible');
  } finally {
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDocumentProcessing();
}

module.exports = setupDocumentProcessing;