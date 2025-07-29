#!/bin/bash

echo "🚀 Deploying Angular app to demo/ngcommerce..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Run this from your Angular project root directory"
    exit 1
fi

# Clean and build
echo "🧹 Cleaning previous build..."
rm -rf dist/

echo "🔨 Building application..."
npm run build -- --configuration=production --base-href="/demo/ngcommerce/"

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Find where index.html actually is
echo "🔍 Finding build output..."
echo "📁 Current project directory: $(basename "$(pwd)")"

# Show the actual dist structure first
echo "📂 Dist directory structure:"
if [ -d "dist" ]; then
    find dist -type d | head -5
    echo ""
    echo "📄 Looking for index.html..."
    find dist -name "index.html" -type f -exec echo "Found: {}" \;
else
    echo "❌ No dist directory found!"
    exit 1
fi

INDEX_FILE=$(find dist -name "index.html" -type f | head -1)

if [ -z "$INDEX_FILE" ]; then
    echo "❌ No index.html found in dist!"
    echo "📁 All files in dist:"
    find dist -type f | head -15
    exit 1
fi

BUILD_DIR=$(dirname "$INDEX_FILE")
echo "✅ Found build files at: $BUILD_DIR"
echo "📝 Note: Project folder is '$(basename "$(pwd)")' but build output is in '$BUILD_DIR'"

# Show what we found
echo "📄 Files in build directory:"
ls -la "$BUILD_DIR/" | head -5

# Switch to release branch
echo "📦 Switching to release branch..."
CURRENT_BRANCH=$(git branch --show-current)

# Create or switch to release branch
git checkout release 2>/dev/null || git checkout --orphan release

# Clean release branch (keep only .git)
echo "🧹 Cleaning release branch..."
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null

# Copy files using the absolute path to avoid any issues
echo "📁 Copying files from $BUILD_DIR to release branch..."
ABSOLUTE_BUILD_DIR="$(cd "$BUILD_DIR" && pwd)"
echo "📍 Absolute source path: $ABSOLUTE_BUILD_DIR"

# Copy all files from the build directory
cd "$ABSOLUTE_BUILD_DIR"
cp -r * "$OLDPWD/"
cd "$OLDPWD"

# Verify copy worked
if [ ! -f "index.html" ]; then
    echo "❌ Copy failed - no index.html found!"
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

echo "✅ Files copied successfully!"
echo "📄 Release branch now contains:"
ls -la | head -10

# Create .htaccess
echo "⚙️ Creating .htaccess..."
cat > .htaccess << 'EOF'
RewriteEngine On
RewriteBase /demo/ngcommerce/

# Handle Angular routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /demo/ngcommerce/index.html [L]

# Security and performance
Header always set X-Frame-Options SAMEORIGIN
Header always set X-Content-Type-Options nosniff

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/css application/javascript text/html
</IfModule>
EOF

# Commit and push
echo "💾 Committing to release branch..."
git add .
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')"

echo "⬆️ Pushing to release branch..."
git push origin release

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed to release branch!"
else
    echo "❌ Failed to push to release branch"
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

# Return to original branch
git checkout "$CURRENT_BRANCH"

echo ""
echo "🎉 Deployment completed!"
echo "🌐 Files are ready for Hostinger at: /demo/ngcommerce/"
echo "🔗 Configure Hostinger to pull from 'release' branch"
echo ""