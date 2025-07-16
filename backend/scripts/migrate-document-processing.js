// scripts/migrate-document-processing.js
// Simple migration script to add document processing tables

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'customer_registration',
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT || 5432,
});

const migrations = [
  {
    name: 'Add UUID extension',
    sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  },
  {
    name: 'Enhance users table',
    sql: `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS documents_processed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_document_processed_at TIMESTAMP;
    `
  },
  {
    name: 'Create documents table',
    sql: `
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
        page_count INTEGER DEFAULT 0,
        extracted_text TEXT,
        processing_started_at TIMESTAMP,
        processing_completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT valid_status CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
        CONSTRAINT valid_mime_type CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/tiff'))
      );
    `
  },
  {
    name: 'Create invoice_data table',
    sql: `
      CREATE TABLE IF NOT EXISTS invoice_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100),
        invoice_date DATE,
        vendor_name VARCHAR(255),
        total_amount DECIMAL(12,2),
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'Create processing_metrics table',
    sql: `
      CREATE TABLE IF NOT EXISTS processing_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        average_ocr_confidence DECIMAL(5,2),
        total_text_length INTEGER,
        pages_processed INTEGER,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'Create indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
      CREATE INDEX IF NOT EXISTS idx_invoice_data_document_id ON invoice_data(document_id);
      CREATE INDEX IF NOT EXISTS idx_processing_metrics_document_id ON processing_metrics(document_id);
    `
  },
  {
    name: 'Create onboarding update trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_user_onboarding_progress()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
          UPDATE users 
          SET 
            documents_processed = documents_processed + 1,
            last_document_processed_at = CURRENT_TIMESTAMP,
            onboarding_completed = CASE 
              WHEN documents_processed + 1 >= 1 THEN TRUE 
              ELSE FALSE 
            END,
            onboarding_completed_at = CASE 
              WHEN documents_processed + 1 >= 1 AND onboarding_completed = FALSE 
              THEN CURRENT_TIMESTAMP 
              ELSE onboarding_completed_at 
            END
          WHERE id = NEW.user_id;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_user_onboarding_progress ON documents;
      CREATE TRIGGER trigger_update_user_onboarding_progress 
        AFTER UPDATE ON documents 
        FOR EACH ROW 
        EXECUTE FUNCTION update_user_onboarding_progress();
    `
  }
];

async function runMigrations() {
  console.log('🚀 Running Document Processing Migrations...\n');

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const migration of migrations) {
      console.log(`📝 ${migration.name}...`);
      try {
        await client.query(migration.sql);
        console.log(`✅ ${migration.name} completed`);
      } catch (error) {
        console.log(`⚠️  ${migration.name} - ${error.message}`);
        // Continue with other migrations even if one fails
      }
    }

    // Update existing users
    console.log('\n🔄 Updating existing users...');
    const updateResult = await client.query(`
      UPDATE users 
      SET 
        documents_processed = COALESCE(documents_processed, 0),
        onboarding_completed = COALESCE(onboarding_completed, false)
      WHERE documents_processed IS NULL OR onboarding_completed IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing users`);

    await client.query('COMMIT');
    console.log('\n🎉 All migrations completed successfully!');

    // Show summary
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'invoice_data', 'processing_metrics')
    `);
    
    console.log(`\n📊 Document processing tables: ${tableCheck.rows.length}/3 created`);
    tableCheck.rows.forEach(row => console.log(`   ✅ ${row.table_name}`));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  });
}

module.exports = runMigrations;