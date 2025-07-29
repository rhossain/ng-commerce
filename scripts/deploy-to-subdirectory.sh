#!/bin/bash

echo "🚀 Deploying Angular app to subdirectory (Debug Version)..."

# Configuration
SOURCE_BRANCH="main"
RELEASE_BRANCH="release"
SUBDIRECTORY="demo/ngcommerce"

# Check if we're in Angular project root
if [ ! -f "package.json" ] || [ ! -f "angular.json" ]; then
    echo "❌ Error: This script must be run from Angular project root directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo "🔍 Checking project structure..."

# Debug: Check current directory contents
echo "📁 Current directory contents:"
ls -la

# Debug: Check angular.json for output path
echo "🔧 Checking angular.json for output path..."
if [ -f "angular.json" ]; then
    OUTPUT_PATH=$(grep -A 10 '"build":' angular.json | grep '"outputPath":' | head -1 | sed 's/.*"outputPath": *"\([^"]*\)".*/\1/')
    echo "📂 Output path from angular.json: $OUTPUT_PATH"
else
    echo "❌ angular.json not found!"
    exit 1
fi

# Set default output path if not found
if [ -z "$OUTPUT_PATH" ]; then
    OUTPUT_PATH="dist"
    echo "⚠️ Using default output path: $OUTPUT_PATH"
fi

echo "🔄 Building application..."
echo "📦 Build command: npm run build -- --configuration=production --base-href=/$SUBDIRECTORY/"

# Build the application with subdirectory configuration
npm run build -- --configuration=production --base-href="/$SUBDIRECTORY/"

# Check build exit code
BUILD_EXIT_CODE=$?
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
    exit 1
fi

echo "🔍 Checking for built files..."

# Debug: List all possible dist directories
echo "📁 Looking for dist directories:"
find . -type d -name "dist*" -maxdepth 2 2>/dev/null || echo "No dist directories found"

# Debug: Check if the output directory exists
if [ -d "$OUTPUT_PATH" ]; then
    echo "✅ Found output directory: $OUTPUT_PATH"
    echo "📄 Contents of $OUTPUT_PATH:"
    ls -la "$OUTPUT_PATH/"
    
    # Check if there are files in the output directory
    FILE_COUNT=$(find "$OUTPUT_PATH" -type f | wc -l)
    echo "📊 Number of files in $OUTPUT_PATH: $FILE_COUNT"
    
    if [ $FILE_COUNT -eq 0 ]; then
        echo "❌ Output directory is empty!"
        exit 1
    fi
else
    echo "❌ Output directory '$OUTPUT_PATH' not found!"
    echo "🔍 Let's check what was created:"
    
    # Look for any new directories created
    echo "📁 All directories in current path:"
    find . -maxdepth 2 -type d -not -path './node_modules*' -not -path './.git*' | sort
    
    # Check for project name in angular.json
    PROJECT_NAME=$(grep -A 5 '"projects":' angular.json | grep -o '"[^"]*":' | head -1 | tr -d '":')
    if [ ! -z "$PROJECT_NAME" ]; then
        echo "🏷️ Project name: $PROJECT_NAME"
        POSSIBLE_DIST_PATH="dist/$PROJECT_NAME"
        echo "🔍 Checking possible path: $POSSIBLE_DIST_PATH"
        
        if [ -d "$POSSIBLE_DIST_PATH" ]; then
            echo "✅ Found build output at: $POSSIBLE_DIST_PATH"
            OUTPUT_PATH="$POSSIBLE_DIST_PATH"
        fi
    fi
    
    if [ ! -d "$OUTPUT_PATH" ]; then
        echo "❌ Still no build output found. Exiting."
        exit 1
    fi
fi

echo "📦 Switching to release branch..."

# Switch to release branch
if git rev-parse --verify $RELEASE_BRANCH >/dev/null 2>&1; then
    git checkout $RELEASE_BRANCH
    # Clear existing files except .git and .gitignore
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' -exec rm -rf {} + 2>/dev/null
else
    echo "🆕 Creating new release branch..."
    git checkout --orphan $RELEASE_BRANCH
    git rm -rf . 2>/dev/null || true
fi

echo "📁 Copying built files from: $OUTPUT_PATH"

# Copy built files
if [ -d "$OUTPUT_PATH" ]; then
    # Check if we need to copy from a subdirectory
    if [ -f "$OUTPUT_PATH/index.html" ]; then
        # Direct copy from output path
        cp -r "$OUTPUT_PATH"/* .
        echo "✅ Copied files directly from $OUTPUT_PATH"
    else
        # Look for index.html in subdirectories
        INDEX_LOCATION=$(find "$OUTPUT_PATH" -name "index.html" -type f | head -1)
        if [ ! -z "$INDEX_LOCATION" ]; then
            BUILD_DIR=$(dirname "$INDEX_LOCATION")
            echo "📍 Found index.html at: $INDEX_LOCATION"
            echo "📂 Copying from: $BUILD_DIR"
            cp -r "$BUILD_DIR"/* .
            echo "✅ Copied files from $BUILD_DIR"
        else
            echo "❌ No index.html found in build output!"
            echo "📄 Contents of $OUTPUT_PATH:"
            find "$OUTPUT_PATH" -type f | head -10
            exit 1
        fi
    fi
else
    echo "❌ Output directory '$OUTPUT_PATH' not found!"
    exit 1
fi

# Verify files were copied
echo "🔍 Verifying copied files..."
if [ -f "index.html" ]; then
    echo "✅ index.html found in release branch"
    echo "📄 Files in release branch:"
    ls -la | head -10
else
    echo "❌ index.html not found after copying!"
    echo "📄 Current directory contents:"
    ls -la
    exit 1
fi

echo "⚙️ Creating .htaccess file..."
# Create .htaccess for subdirectory deployment
cat > .htaccess << EOF
RewriteEngine On
RewriteBase /$SUBDIRECTORY/

# Handle Angular routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /$SUBDIRECTORY/index.html [L]

# Security headers
Header always set X-Frame-Options SAMEORIGIN
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"

# Gzip compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css
    AddOutputFilterByType DEFLATE application/xml application/xhtml+xml application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
EOF

echo "📄 Creating deployment info..."
# Create deployment info file
cat > deployment-info.json << EOF
{
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "branch": "$SOURCE_BRANCH",
  "subdirectory": "$SUBDIRECTORY",
  "baseHref": "/$SUBDIRECTORY/",
  "environment": "production",
  "outputPath": "$OUTPUT_PATH",
  "deployedFrom": "$(whoami)@$(hostname)"
}
EOF

echo "💾 Committing changes..."
# Add and commit
git add .
git commit -m "Deploy to $SUBDIRECTORY - $(date '+%Y-%m-%d %H:%M:%S') from $SOURCE_BRANCH"

echo "⬆️ Pushing to release branch..."
# Push to release branch
git push origin $RELEASE_BRANCH

echo "✅ Deployment to release branch completed!"
echo "🌐 Ready for Hostinger deployment to: $SUBDIRECTORY"
echo "🔗 Your app will be available at: https://rshossain.com/$SUBDIRECTORY/"

# Return to source branch
git checkout $SOURCE_BRANCH

echo "🎉 Done! You can now configure Hostinger to pull from the 'release' branch."