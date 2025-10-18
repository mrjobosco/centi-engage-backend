#!/bin/bash

# Script to update permissions and roles in the database
# This script runs the migration and optionally reseeds the database

set -e

echo "🚀 Starting permission system update..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please create it with DATABASE_URL"
    exit 1
fi

# Load environment variables
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env file"
    exit 1
fi

echo "📊 Current database: $DATABASE_URL"

# Run the migration
echo "🔄 Running permission migration..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

# Ask if user wants to reseed the database
echo ""
read -p "🌱 Do you want to reseed the database with updated permissions? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Reseeding database with comprehensive permissions..."
    
    # Backup current seed file
    if [ -f "prisma/seed.ts" ]; then
        cp prisma/seed.ts prisma/seed-backup.ts
        echo "📋 Backed up current seed file to prisma/seed-backup.ts"
    fi
    
    # Replace seed file with updated version
    cp prisma/seed-updated.ts prisma/seed.ts
    echo "📝 Updated seed file with comprehensive permissions"
    
    # Run the seed
    npx prisma db seed
    
    if [ $? -eq 0 ]; then
        echo "✅ Database seeded successfully with comprehensive permissions!"
    else
        echo "❌ Seeding failed!"
        # Restore backup if seeding failed
        if [ -f "prisma/seed-backup.ts" ]; then
            cp prisma/seed-backup.ts prisma/seed.ts
            echo "🔄 Restored original seed file"
        fi
        exit 1
    fi
else
    echo "⏭️  Skipping database reseed"
fi

echo ""
echo "🎉 Permission system update completed!"
echo ""
echo "📋 Summary of changes:"
echo "   ✅ Added invitation management permissions (create, read, update, delete)"
echo "   ✅ Added notification system permissions (create, read, update, delete, broadcast)"
echo "   ✅ Added notification preference permissions (read, update)"
echo "   ✅ Added notification template permissions (create, read, update, delete)"
echo "   ✅ Added tenant management permissions (read, update, manage)"
echo "   ✅ Added audit and monitoring permissions (read audit-log, system metrics)"
echo "   ✅ Added Google OAuth management permissions (manage, configure)"
echo "   ✅ Added reporting permissions (read, export, create)"
echo "   ✅ Updated existing Admin roles with all new permissions"
echo "   ✅ Updated Member roles with appropriate read and self-management permissions"
echo "   ✅ Updated Project Manager roles with team coordination permissions"
echo "   ✅ Created new specialized roles: HR Manager, Notification Manager, System Administrator"
echo ""
echo "🔑 New roles available:"
echo "   - Admin: Full system access (all permissions)"
echo "   - Member: Basic access with self-management"
echo "   - Project Manager: Project and team management"
echo "   - HR Manager: User and invitation management"
echo "   - Notification Manager: Notification system management"
echo "   - System Administrator: System configuration and monitoring"
echo ""
echo "📖 Next steps:"
echo "   1. Test the API endpoints to ensure permissions are working correctly"
echo "   2. Update any frontend applications to handle the new permission structure"
echo "   3. Review and adjust role assignments for existing users as needed"
echo "   4. Consider creating custom roles for specific use cases"
echo ""
echo "🔍 To verify the changes:"
echo "   npx prisma studio  # Open Prisma Studio to browse the database"
echo "   npm run test       # Run tests to ensure everything works"