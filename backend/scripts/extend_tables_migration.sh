#!/bin/bash

# =============================================================================
# USER MANAGEMENT SYSTEM - DATABASE MIGRATION SCRIPT
# Extends existing PostgreSQL tables for RBAC and user management features
# =============================================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-customer_registration}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Functions
print_header() {
    echo -e "\n${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if psql is available
check_psql() {
    if ! command -v psql &> /dev/null; then
        print_error "psql command not found. Please install PostgreSQL client."
        exit 1
    fi
    print_success "PostgreSQL client found"
}

# Test database connection
test_connection() {
    print_info "Testing database connection..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful"
        return 0
    else
        print_error "Database connection failed"
        print_info "Please check your database credentials and ensure the database is running"
        return 1
    fi
}

# Check current database structure
check_existing_structure() {
    print_header "CHECKING EXISTING DATABASE STRUCTURE"
    
    print_info "Checking existing tables..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            table_name,
            CASE 
                WHEN table_name = 'users' THEN '✓ Required'
                WHEN table_name = 'tenants' THEN '✓ Good for multi-tenant'
                ELSE '• Other table'
            END as status
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    "
    
    print_info "Checking users table structure..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d users" > /dev/null 2>&1; then
        print_success "Users table exists"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                CASE 
                    WHEN column_name IN ('id', 'email', 'password', 'created_at') THEN '✓ Core field'
                    WHEN column_name IN ('role', 'status', 'invitation_token') THEN '✓ RBAC ready'
                    ELSE '• Additional field'
                END as category
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position;
        "
    else
        print_error "Users table not found! Please create users table first."
        exit 1
    fi
}

# Create backup
create_backup() {
    print_header "CREATING DATABASE BACKUP"
    
    BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
    print_info "Creating backup: $BACKUP_FILE"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
        print_success "Backup created: $BACKUP_FILE"
    else
        print_warning "Backup creation failed, but continuing with migration"
    fi
}

# Add RBAC columns to existing users table
extend_users_table() {
    print_header "EXTENDING USERS TABLE FOR RBAC"
    
    print_info "Adding role-based access control columns..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Add role column with constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'viewer' 
            CHECK (role IN ('admin', 'validator', 'viewer'));
        RAISE NOTICE 'Added role column to users table';
    ELSE
        RAISE NOTICE 'Role column already exists in users table';
    END IF;
END $$;

-- Add status column with constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
            CHECK (status IN ('pending', 'active', 'suspended', 'deleted'));
        RAISE NOTICE 'Added status column to users table';
    ELSE
        RAISE NOTICE 'Status column already exists in users table';
    END IF;
END $$;

-- Add invitation token column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'invitation_token'
    ) THEN
        ALTER TABLE users ADD COLUMN invitation_token VARCHAR(255);
        RAISE NOTICE 'Added invitation_token column to users table';
    ELSE
        RAISE NOTICE 'Invitation_token column already exists in users table';
    END IF;
END $$;

-- Add invitation expiry column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'invitation_expires_at'
    ) THEN
        ALTER TABLE users ADD COLUMN invitation_expires_at TIMESTAMP;
        RAISE NOTICE 'Added invitation_expires_at column to users table';
    ELSE
        RAISE NOTICE 'Invitation_expires_at column already exists in users table';
    END IF;
END $$;

-- Add last login column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
        RAISE NOTICE 'Added last_login column to users table';
    ELSE
        RAISE NOTICE 'Last_login column already exists in users table';
    END IF;
END $$;

-- Add first_name and last_name if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
        RAISE NOTICE 'Added first_name column to users table';
    ELSE
        RAISE NOTICE 'First_name column already exists in users table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
        RAISE NOTICE 'Added last_name column to users table';
    ELSE
        RAISE NOTICE 'Last_name column already exists in users table';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to users table';
    ELSE
        RAISE NOTICE 'Updated_at column already exists in users table';
    END IF;
END $$;
EOF
    
    print_success "Users table extension completed"
}

# Create business entities table
create_business_entities_table() {
    print_header "CREATING BUSINESS ENTITIES TABLE"
    
    print_info "Creating business_entities table..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create business_entities table
CREATE TABLE IF NOT EXISTS business_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    tenant_id UUID, -- Will reference tenants(id) if tenants table exists
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to tenants if table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tenants'
    ) THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'business_entities_tenant_id_fkey'
        ) THEN
            ALTER TABLE business_entities 
            ADD CONSTRAINT business_entities_tenant_id_fkey 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id);
            RAISE NOTICE 'Added foreign key constraint to tenants table';
        END IF;
    ELSE
        RAISE NOTICE 'Tenants table not found, skipping foreign key constraint';
    END IF;
END $$;

-- Create index on tenant_id for performance
CREATE INDEX IF NOT EXISTS idx_business_entities_tenant_id ON business_entities(tenant_id);

COMMENT ON TABLE business_entities IS 'Business entities for validator assignments';
COMMENT ON COLUMN business_entities.code IS 'Unique business entity code';
COMMENT ON COLUMN business_entities.tenant_id IS 'Reference to tenant (if multi-tenant)';
EOF
    
    print_success "Business entities table created"
}

# Create user-business entity mapping table
create_user_business_entities_table() {
    print_header "CREATING USER-BUSINESS ENTITY MAPPING TABLE"
    
    print_info "Creating user_business_entities mapping table..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create user_business_entities mapping table
CREATE TABLE IF NOT EXISTS user_business_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_entity_id UUID NOT NULL REFERENCES business_entities(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    UNIQUE(user_id, business_entity_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_business_entities_user_id ON user_business_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_business_entities_business_entity_id ON user_business_entities(business_entity_id);

COMMENT ON TABLE user_business_entities IS 'Maps users to business entities (for validators)';
COMMENT ON COLUMN user_business_entities.assigned_by IS 'User who made the assignment';
EOF
    
    print_success "User-business entity mapping table created"
}

# Create audit logs table
create_audit_logs_table() {
    print_header "CREATING AUDIT LOGS TABLE"
    
    print_info "Creating audit_logs table..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    tenant_id UUID, -- Will reference tenants(id) if exists
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key to tenants if table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tenants'
    ) THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'audit_logs_tenant_id_fkey'
        ) THEN
            ALTER TABLE audit_logs 
            ADD CONSTRAINT audit_logs_tenant_id_fkey 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id);
            RAISE NOTICE 'Added foreign key constraint to tenants table for audit_logs';
        END IF;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

COMMENT ON TABLE audit_logs IS 'Audit trail for all user actions';
COMMENT ON COLUMN audit_logs.details IS 'JSON details of the action';
EOF
    
    print_success "Audit logs table created"
}

# Create permissions system tables
create_permissions_tables() {
    print_header "CREATING PERMISSIONS SYSTEM TABLES"
    
    print_info "Creating permissions and role_permissions tables..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL
);

-- Create role_permissions mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

COMMENT ON TABLE permissions IS 'System permissions for RBAC';
COMMENT ON TABLE role_permissions IS 'Maps roles to permissions';
EOF
    
    print_success "Permissions system tables created"
}

# Insert default permissions and role mappings
insert_default_permissions() {
    print_header "INSERTING DEFAULT PERMISSIONS"
    
    print_info "Inserting default permissions and role mappings..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('user.create', 'Create new users', 'user', 'create'),
('user.read', 'View user information', 'user', 'read'),
('user.update', 'Update user information', 'user', 'update'),
('user.delete', 'Delete users', 'user', 'delete'),
('user.invite', 'Invite new users', 'user', 'invite'),
('business_entity.read', 'View business entities', 'business_entity', 'read'),
('business_entity.create', 'Create business entities', 'business_entity', 'create'),
('business_entity.update', 'Update business entities', 'business_entity', 'update'),
('business_entity.delete', 'Delete business entities', 'business_entity', 'delete'),
('audit.read', 'View audit logs', 'audit', 'read')
ON CONFLICT (name) DO NOTHING;

-- Insert role permissions for admin (all permissions)
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Insert role permissions for validator (limited permissions)
INSERT INTO role_permissions (role, permission_id) 
SELECT 'validator', id FROM permissions 
WHERE name IN ('user.read', 'business_entity.read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Insert role permissions for viewer (read-only permissions)
INSERT INTO role_permissions (role, permission_id) 
SELECT 'viewer', id FROM permissions 
WHERE name IN ('user.read', 'business_entity.read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Show inserted permissions count
SELECT 
    'admin' as role, 
    COUNT(*) as permissions_count 
FROM role_permissions WHERE role = 'admin'
UNION ALL
SELECT 
    'validator' as role, 
    COUNT(*) as permissions_count 
FROM role_permissions WHERE role = 'validator'
UNION ALL
SELECT 
    'viewer' as role, 
    COUNT(*) as permissions_count 
FROM role_permissions WHERE role = 'viewer';
EOF
    
    print_success "Default permissions and role mappings inserted"
}

# Migrate existing user data
migrate_existing_users() {
    print_header "MIGRATING EXISTING USER DATA"
    
    print_info "Setting default roles and status for existing users..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Update existing users with default values
UPDATE users 
SET 
    role = CASE 
        WHEN email LIKE '%admin%' OR 
             EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'is_admin' 
                    AND users.is_admin = true) 
        THEN 'admin'
        ELSE 'viewer'
    END,
    status = CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'email_verified')
        THEN CASE 
            WHEN email_verified = true THEN 'active'
            ELSE 'pending'
        END
        ELSE 'active'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE role IS NULL OR status IS NULL;

-- Show migration results
SELECT 
    role,
    status,
    COUNT(*) as user_count
FROM users 
GROUP BY role, status
ORDER BY role, status;
EOF
    
    print_success "Existing user data migration completed"
}

# Create business entities from tenants
create_business_entities_from_tenants() {
    print_header "CREATING BUSINESS ENTITIES FROM TENANTS"
    
    # Check if tenants table exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d tenants" > /dev/null 2>&1; then
        print_info "Tenants table found, creating business entities..."
        
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create business entities from existing tenants
INSERT INTO business_entities (name, code, description, tenant_id)
SELECT 
    name,
    UPPER(REPLACE(REPLACE(name, ' ', '_'), '-', '_')) as code,
    COALESCE(description, 'Auto-created from tenant: ' || name),
    id as tenant_id
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM business_entities WHERE tenant_id = tenants.id
)
ON CONFLICT (code) DO NOTHING;

-- Show created business entities
SELECT 
    COUNT(*) as created_entities,
    'business entities created from tenants' as description
FROM business_entities 
WHERE tenant_id IS NOT NULL;
EOF
        
        print_success "Business entities created from tenants"
    else
        print_warning "Tenants table not found, skipping business entity creation from tenants"
    fi
}

# Verify migration
verify_migration() {
    print_header "VERIFYING MIGRATION"
    
    print_info "Checking migration results..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Check users table structure
SELECT 'Users table columns:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('role', 'status', 'invitation_token', 'last_login') THEN '✓ New RBAC column'
        WHEN column_name IN ('id', 'email', 'password', 'created_at') THEN '✓ Existing column'
        ELSE '• Other column'
    END as category
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check new tables
SELECT '' as spacer;
SELECT 'New tables created:' as info;
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'business_entities' THEN '✓ Business entities for validators'
        WHEN table_name = 'user_business_entities' THEN '✓ User-entity mappings'
        WHEN table_name = 'audit_logs' THEN '✓ Audit trail'
        WHEN table_name = 'permissions' THEN '✓ Permission system'
        WHEN table_name = 'role_permissions' THEN '✓ Role-permission mappings'
        ELSE '• Other table'
    END as purpose
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('business_entities', 'user_business_entities', 'audit_logs', 'permissions', 'role_permissions')
ORDER BY table_name;

-- Check user counts by role
SELECT '' as spacer;
SELECT 'User distribution by role:' as info;
SELECT 
    role,
    status,
    COUNT(*) as count
FROM users 
GROUP BY role, status
ORDER BY role, status;

-- Check permissions count
SELECT '' as spacer;
SELECT 'Permissions system:' as info;
SELECT 
    (SELECT COUNT(*) FROM permissions) as total_permissions,
    (SELECT COUNT(*) FROM role_permissions WHERE role = 'admin') as admin_permissions,
    (SELECT COUNT(*) FROM role_permissions WHERE role = 'validator') as validator_permissions,
    (SELECT COUNT(*) FROM role_permissions WHERE role = 'viewer') as viewer_permissions;

-- Check business entities
SELECT '' as spacer;
SELECT 'Business entities:' as info;
SELECT COUNT(*) as total_business_entities FROM business_entities;
EOF
    
    print_success "Migration verification completed"
}

# Show next steps
show_next_steps() {
    print_header "MIGRATION COMPLETED SUCCESSFULLY!"
    
    echo -e "\n${GREEN}✓ Database migration completed successfully!${NC}\n"
    
    print_info "What was done:"
    echo "  • Extended users table with RBAC columns (role, status, invitation_token, etc.)"
    echo "  • Created business_entities table for validator assignments"
    echo "  • Created user_business_entities mapping table"
    echo "  • Created audit_logs table for tracking actions"
    echo "  • Created permissions system (permissions, role_permissions tables)"
    echo "  • Inserted default permissions for admin/validator/viewer roles"
    echo "  • Migrated existing users with default roles and status"
    echo "  • Created business entities from tenants (if tenants table exists)"
    
    print_info "Next steps:"
    echo "  1. Update your backend code to use the new RBAC system"
    echo "  2. Add the new user management routes"
    echo "  3. Update your frontend to include user management components"
    echo "  4. Test the new functionality"
    echo "  5. Deploy to production"
    
    print_info "Backup file created: ${BACKUP_FILE:-No backup created}"
    
    echo -e "\n${BLUE}Your database is now ready for the user management system!${NC}"
}

# Main execution function
main() {
    print_header "USER MANAGEMENT SYSTEM - DATABASE MIGRATION"
    echo -e "This script will extend your existing PostgreSQL database for user management.\n"
    
    # Get database connection details if not set
    if [ "$DB_NAME" = "your_database_name" ]; then
        read -p "Enter database name: " DB_NAME
    fi
    
    if [ -z "$PGPASSWORD" ]; then
        read -s -p "Enter database password for user $DB_USER: " PGPASSWORD
        export PGPASSWORD
        echo
    fi
    
    # Execute migration steps
    check_psql
    test_connection || exit 1
    
    echo -e "\n${YELLOW}Warning: This will modify your database. A backup will be created.${NC}"
    read -p "Continue with migration? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        check_existing_structure
        create_backup
        extend_users_table
        create_business_entities_table
        create_user_business_entities_table
        create_audit_logs_table
        create_permissions_tables
        insert_default_permissions
        migrate_existing_users
        create_business_entities_from_tenants
        verify_migration
        show_next_steps
    else
        print_info "Migration cancelled by user"
        exit 0
    fi
}

# Script usage help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -d, --database      Database name"
    echo "  -u, --user          Database user (default: postgres)"
    echo "  -H, --host          Database host (default: localhost)"
    echo "  -p, --port          Database port (default: 5432)"
    echo ""
    echo "Environment variables:"
    echo "  DB_NAME             Database name"
    echo "  DB_USER             Database user"
    echo "  DB_HOST             Database host"
    echo "  DB_PORT             Database port"
    echo "  PGPASSWORD          Database password"
    echo ""
    echo "Examples:"
    echo "  $0 -d myapp_db -u myuser"
    echo "  DB_NAME=myapp_db DB_USER=myuser $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -H|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"