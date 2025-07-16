const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const runMigrations = async () => {
  try {
    console.log('🔄 Running database migrations...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        is_domain_verified BOOLEAN DEFAULT FALSE,
        subscription_type VARCHAR(50) DEFAULT 'trial',
        trial_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        company_id INTEGER REFERENCES companies(id),
        is_email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP,
        terms_accepted BOOLEAN DEFAULT FALSE,
        terms_accepted_at TIMESTAMP,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trial_limitations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        max_users INTEGER DEFAULT 5,
        max_projects INTEGER DEFAULT 3,
        max_storage_mb INTEGER DEFAULT 1000,
        features_enabled JSONB DEFAULT '{"basic": true, "advanced": false, "premium": false}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigrations();