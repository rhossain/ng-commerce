#!/bin/bash

echo "🚀 Deploying Angular app to demo/ngcommerce..."

# Configuration
SUBDIRECTORY="demo/ngcommerce"

# Check if we're in Angular project root directory
if [ ! -f "package.json" ] || [ ! -f "angular.json" ]; then
    echo "❌ Error: This script must be run from Angular project root directory"
    echo "📍 Current directory: $(pwd)"
    echo "📁 Make sure you're in the directory containing package.json and angular.json"
    exit 1
fi

echo "📍 Current project directory: $(basename "$(pwd)")"

# Clean any previous build to avoid conflicts
echo "🧹 Cleaning previous build..."
rm -rf dist/

echo "🔨 Building application for production..."
npm run build -- --configuration=production --base-href="/$SUBDIRECTORY/"

# Check if build was successful
BUILD_EXIT_CODE=$?
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
    echo "🔍 Check your Angular configuration and dependencies"
    exit 1
fi

# Find where index.html actually is
echo "🔍 Finding build output..."
echo "📂 Dist directory structure:"
if [ -d "dist" ]; then
    find dist -type d | head -5
    echo ""
    echo "📄 Looking for index.html..."
    find dist -name "index.html" -type f -exec echo "Found: {}" \;
else
    echo "❌ No dist directory found after build!"
    exit 1
fi

INDEX_FILE=$(find dist -name "index.html" -type f | head -1)

if [ -z "$INDEX_FILE" ]; then
    echo "❌ No index.html found in dist directory!"
    echo "📁 All files in dist:"
    find dist -type f | head -15
    exit 1
fi

BUILD_DIR=$(dirname "$INDEX_FILE")
echo "✅ Found build files at: $BUILD_DIR"
echo "📝 Note: Project folder is '$(basename "$(pwd)")' but build output is in '$BUILD_DIR'"

# Show what we found in the build directory
echo "📄 Files in build directory:"
ls -la "$BUILD_DIR/" | head -8

# Verify build directory has content
FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l | tr -d ' ')
echo "📊 Total files in build output: $FILE_COUNT"

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "❌ Build output directory is empty!"
    exit 1
fi

# Save current branch name
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Current branch: $CURRENT_BRANCH"

# Switch to release branch
echo "📦 Switching to release branch..."
if git rev-parse --verify release >/dev/null 2>&1; then
    # Release branch exists, switch to it
    git checkout release
    if [ $? -ne 0 ]; then
        echo "❌ Failed to checkout release branch"
        exit 1
    fi
else
    # Create new release branch
    echo "🆕 Creating new release branch..."
    git checkout --orphan release
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create release branch"
        exit 1
    fi
fi

# Clean release branch (remove all files except .git)
echo "🧹 Cleaning release branch..."
find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' -exec rm -rf {} + 2>/dev/null

# Copy built files to release branch
echo "📁 Copying files from $BUILD_DIR to release branch..."
echo "📍 Source: $BUILD_DIR"
echo "📍 Target: $(pwd)"

# Simple, reliable copy method
if [ -d "$BUILD_DIR" ]; then
    cp -r "$BUILD_DIR"/* . 2>/dev/null
    # Also copy any hidden files
    cp -r "$BUILD_DIR"/.[^.]* . 2>/dev/null || true
    echo "✅ Copy completed"
else
    echo "❌ Source directory '$BUILD_DIR' not found!"
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

# Verify files were copied successfully
echo "🔍 Verifying copied files..."
if [ ! -f "index.html" ]; then
    echo "❌ Copy failed - no index.html found in release branch!"
    echo "📄 Current release branch contents:"
    ls -la
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

echo "✅ Files copied successfully to release branch!"
FILE_COUNT_COPIED=$(find . -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "📊 Files in release branch: $FILE_COUNT_COPIED"

echo "📄 Release branch contents:"
ls -la | head -10

# Create .htaccess for Angular routing in subdirectory
echo "⚙️ Creating .htaccess file for subdirectory routing..."
cat > .htaccess << EOF
RewriteEngine On
RewriteBase /$SUBDIRECTORY/

# Handle Angular routing - redirect all requests to index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /$SUBDIRECTORY/index.html [L]

# Security headers
Header always set X-Frame-Options SAMEORIGIN
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"

# Gzip compression for better performance
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
    ExpiresByType image/ico "access plus 1 month"
</IfModule>
EOF

# Create deployment info file for debugging
echo "📄 Creating deployment info..."
cat > deployment-info.json << EOF
{
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployedFrom": "$CURRENT_BRANCH",
  "subdirectory": "$SUBDIRECTORY",
  "baseHref": "/$SUBDIRECTORY/",
  "environment": "production",
  "buildOutput": "$BUILD_DIR",
  "projectDirectory": "$(basename "$(pwd)")",
  "deployedBy": "$(whoami)@$(hostname)",
  "nodeVersion": "$(node --version 2>/dev/null || echo 'unknown')",
  "angularVersion": "$(ng version --json 2>/dev/null | grep -o '"@angular/core": "[^"]*"' || echo 'unknown')"
}
EOF

# Add all files to git
echo "💾 Adding files to git..."
git add .

# Check if there are actually changes to commit
if git diff --staged --quiet; then
    echo "⚠️ No changes detected in release branch"
    echo "ℹ️ Files are identical to previous deployment"
    git checkout "$CURRENT_BRANCH"
    echo "✨ No deployment needed - everything is up to date!"
    exit 0
fi

# Commit changes
echo "💾 Committing changes to release branch..."
COMMIT_MESSAGE="Deploy to $SUBDIRECTORY - $(date '+%Y-%m-%d %H:%M:%S') from $CURRENT_BRANCH"
git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to commit changes"
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

# Push to release branch
echo "⬆️ Pushing to release branch..."
git push origin release
PUSH_EXIT_CODE=$?

# Always return to original branch
echo "🔄 Returning to $CURRENT_BRANCH branch..."
git checkout "$CURRENT_BRANCH"

if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Failed to return to $CURRENT_BRANCH branch"
    echo "🔍 Current branch: $(git branch --show-current)"
    echo "💡 Manually run: git checkout $CURRENT_BRANCH"
fi

# Check push results and show appropriate message
if [ $PUSH_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "✅ Files pushed to release branch"
    echo "🌐 Ready for Hostinger deployment!"
    echo ""
    echo "📋 Next steps for Hostinger setup:"
    echo "1. Go to Hostinger Control Panel → Advanced → Git"
    echo "2. Create repository with these settings:"
    echo "   - Repository URL: $(git config --get remote.origin.url)"
    echo "   - Branch: release"
    echo "   - Repository Path: /public_html/$SUBDIRECTORY"
    echo "   - Auto Deploy: Enable"
    echo "3. Your app will be available at: https://yourdomain.com/$SUBDIRECTORY/"
    echo ""
    echo "🔍 Debug info saved in deployment-info.json"
else
    echo ""
    echo "❌ Failed to push to release branch (exit code: $PUSH_EXIT_CODE)"
    echo "🔍 Possible issues:"
    echo "   - Check your git credentials"
    echo "   - Verify network connection"
    echo "   - Ensure you have push access to the repository"
    echo "   - Try: git push origin release --verbose"
    exit 1
fi