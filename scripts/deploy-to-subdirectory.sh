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

# Clean any previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

echo "🔄 Building application..."

# Build the application with subdirectory configuration
npm run build -- --configuration=production --base-href="/$SUBDIRECTORY/"

# Check build exit code
BUILD_EXIT_CODE=$?
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
    exit 1
fi

echo "🔍 Analyzing build output structure..."

# Debug: Show the actual structure that was created
echo "📁 Actual dist structure:"
if [ -d "dist" ]; then
    find dist -type f -name "index.html" -exec echo "Found index.html at: {}" \;
    echo ""
    echo "📂 Full dist structure (first 10 items):"
    find dist -type f | head -10
    echo ""
else
    echo "❌ No dist directory found!"
    exit 1
fi

# Find the actual build output directory by looking for index.html
BUILD_OUTPUT=""
INDEX_LOCATION=$(find dist -name "index.html" -type f | head -1)

if [ -z "$INDEX_LOCATION" ]; then
    echo "❌ No index.html found in dist directory!"
    echo "📁 Contents of dist:"
    ls -la dist/
    exit 1
fi

BUILD_OUTPUT=$(dirname "$INDEX_LOCATION")
echo "✅ Found index.html at: $INDEX_LOCATION"
echo "✅ Using build output directory: $BUILD_OUTPUT"

# Verify the directory exists and has content
if [ ! -d "$BUILD_OUTPUT" ]; then
    echo "❌ Build output directory '$BUILD_OUTPUT' does not exist!"
    exit 1
fi

FILE_COUNT=$(find "$BUILD_OUTPUT" -type f | wc -l | tr -d ' ')
echo "📊 Files in build output: $FILE_COUNT"

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "❌ Build output directory is empty!"
    exit 1
fi

echo "📄 Build output contents:"
ls -la "$BUILD_OUTPUT/" | head -8

echo "📦 Switching to release branch..."

# Save current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Switch to release branch
if git rev-parse --verify $RELEASE_BRANCH >/dev/null 2>&1; then
    git checkout $RELEASE_BRANCH
    if [ $? -ne 0 ]; then
        echo "❌ Failed to checkout release branch"
        exit 1
    fi
    echo "🧹 Cleaning release branch..."
    # Remove all files except .git directory, be more careful
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' -print0 | xargs -0 rm -rf 2>/dev/null
else
    echo "🆕 Creating new release branch..."
    git checkout --orphan $RELEASE_BRANCH
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create release branch"
        exit 1
    fi
    # Remove all tracked files
    git rm -rf . 2>/dev/null || true
fi

echo "📁 Copying built files from: $BUILD_OUTPUT"
echo "📍 Current working directory for copy: $(pwd)"

# Method 1: Try rsync if available (most reliable)
if command -v rsync >/dev/null 2>&1; then
    echo "🔄 Using rsync to copy files..."
    rsync -av "$BUILD_OUTPUT/" . --exclude='.git'
    COPY_SUCCESS=$?
else
    # Method 2: Use cp with better error handling
    echo "🔄 Using cp to copy files..."
    if [ -d "$BUILD_OUTPUT" ]; then
        # First, let's see what we're trying to copy
        echo "📋 Files to copy:"
        ls -la "$BUILD_OUTPUT/"
        
        # Copy with verbose output
        cp -rv "$BUILD_OUTPUT"/* . 2>&1
        COPY_SUCCESS=$?
        
        if [ $COPY_SUCCESS -ne 0 ]; then
            echo "❌ cp command failed, trying alternative method..."
            # Method 3: Copy files one by one
            cd "$BUILD_OUTPUT"
            for file in *; do
                if [ -f "$file" ]; then
                    cp "$file" "../../../" 2>/dev/null || echo "⚠️ Failed to copy $file"
                elif [ -d "$file" ]; then
                    cp -r "$file" "../../../" 2>/dev/null || echo "⚠️ Failed to copy directory $file"
                fi
            done
            cd - >/dev/null
            COPY_SUCCESS=0  # Assume success for this method
        fi
    else
        echo "❌ Source directory $BUILD_OUTPUT does not exist!"
        git checkout "$CURRENT_BRANCH"
        exit 1
    fi
fi

# Verify files were copied successfully
echo "🔍 Verifying copied files..."
if [ -f "index.html" ]; then
    echo "✅ index.html successfully copied"
    FILE_COUNT_COPIED=$(find . -maxdepth 1 -type f | wc -l | tr -d ' ')
    echo "📊 Files copied to release branch: $FILE_COUNT_COPIED"
    
    echo "📄 Release branch contents:"
    ls -la | head -10
else
    echo "❌ index.html not found after copying!"
    echo "📄 Current release branch contents:"
    ls -la
    echo ""
    echo "📁 Original build output still exists at:"
    ls -la "$BUILD_OUTPUT/"
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

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
  "deployedFrom": "$(whoami)@$(hostname)",
  "filesCopied": true
}
EOF

echo "💾 Adding files to git..."
# Add all files
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "⚠️ No changes detected in release branch"
    echo "📄 Current git status:"
    git status
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
echo ""
echo "🔍 Debug info saved in deployment-info.json on release branch"