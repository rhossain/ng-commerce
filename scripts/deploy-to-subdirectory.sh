#!/bin/bash

echo "🚀 Deploying Angular app to demo/ngcommerce..."

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
echo "🔄 Building application..."

# Build the application with subdirectory configuration
npm run build -- --configuration=production --base-href="/$SUBDIRECTORY/"

# Check build exit code
BUILD_EXIT_CODE=$?
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
    exit 1
fi

echo "🔍 Looking for build output..."

# Find the actual build output directory
BUILD_OUTPUT=""

# Check for Angular 17+ structure: dist/project-name/browser/
if [ -d "dist" ]; then
    echo "📁 Found dist directory"
    
    # First check for the new Angular 17+ structure (dist/project-name/browser/)
    BROWSER_DIR=$(find dist -name "browser" -type d | head -1)
    if [ ! -z "$BROWSER_DIR" ] && [ -f "$BROWSER_DIR/index.html" ]; then
        BUILD_OUTPUT="$BROWSER_DIR"
        echo "✅ Found Angular 17+ build output at: $BUILD_OUTPUT"
    else
        # Fallback: Look for index.html anywhere in dist
        INDEX_FILE=$(find dist -name "index.html" -type f | head -1)
        if [ ! -z "$INDEX_FILE" ]; then
            BUILD_OUTPUT=$(dirname "$INDEX_FILE")
            echo "✅ Found build output at: $BUILD_OUTPUT"
        else
            echo "❌ No index.html found in dist directory"
            echo "📁 Contents of dist:"
            find dist -type f | head -10
            exit 1
        fi
    fi
    
    echo "📄 Build output contents:"
    ls -la "$BUILD_OUTPUT/" | head -5
else
    echo "❌ No dist directory found after build"
    echo "📁 Current directory contents:"
    ls -la | grep -v node_modules
    exit 1
fi

# Verify we have the essential files
if [ ! -f "$BUILD_OUTPUT/index.html" ]; then
    echo "❌ index.html not found in $BUILD_OUTPUT"
    exit 1
fi

echo "📦 Switching to release branch..."

# Save current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Switch to release branch
if git rev-parse --verify $RELEASE_BRANCH >/dev/null 2>&1; then
    git checkout $RELEASE_BRANCH
    echo "🧹 Cleaning release branch..."
    # Remove all files except .git directory
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
else
    echo "🆕 Creating new release branch..."
    git checkout --orphan $RELEASE_BRANCH
    # Remove all tracked files
    git rm -rf . 2>/dev/null || true
fi

echo "📁 Copying built files from: $BUILD_OUTPUT"

# Copy all files from build output
cp -r "$BUILD_OUTPUT"/* . 2>/dev/null || {
    echo "❌ Failed to copy files from $BUILD_OUTPUT"
    # Try alternative copy method
    echo "🔄 Trying alternative copy method..."
    find "$BUILD_OUTPUT" -type f -exec cp {} . \; 2>/dev/null || {
        echo "❌ Alternative copy also failed"
        git checkout "$CURRENT_BRANCH"
        exit 1
    }
}

# Verify essential files were copied
if [ ! -f "index.html" ]; then
    echo "❌ index.html not found after copying!"
    echo "📄 Current directory contents:"
    ls -la
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

echo "✅ Files successfully copied to release branch"
echo "📄 Release branch contents:"
ls -la | head -10

echo "⚙️ Creating .htaccess file..."
# Create .htaccess for subdirectory deployment
cat > .htaccess << 'EOF'
RewriteEngine On
RewriteBase /demo/ngcommerce/

# Handle Angular routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /demo/ngcommerce/index.html [L]

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
  "branch": "$CURRENT_BRANCH",
  "subdirectory": "$SUBDIRECTORY",
  "baseHref": "/$SUBDIRECTORY/",
  "environment": "production",
  "buildOutput": "$BUILD_OUTPUT",
  "deployedFrom": "$(whoami)@$(hostname)"
}
EOF

echo "💾 Adding files to git..."
# Add all files
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "⚠️ No changes detected in release branch"
else
    echo "💾 Committing changes..."
    git commit -m "Deploy to $SUBDIRECTORY - $(date '+%Y-%m-%d %H:%M:%S') from $CURRENT_BRANCH"
    
    echo "⬆️ Pushing to release branch..."
    git push origin $RELEASE_BRANCH
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pushed to release branch!"
    else
        echo "❌ Failed to push to release branch"
        git checkout "$CURRENT_BRANCH"
        exit 1
    fi
fi

echo "🔄 Returning to $CURRENT_BRANCH branch..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "🎉 Deployment completed successfully!"
echo "🌐 Ready for Hostinger deployment to: $SUBDIRECTORY"
echo "🔗 Your app will be available at: https://yourdomain.com/$SUBDIRECTORY/"
echo ""
echo "📋 Next steps:"
echo "1. Configure Hostinger Git to pull from 'release' branch"
echo "2. Set repository path to: /public_html/demo/ngcommerce"
echo "3. Enable auto-deploy in Hostinger"