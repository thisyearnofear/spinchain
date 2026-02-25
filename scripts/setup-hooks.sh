#!/bin/bash
#
# Setup script to install git hooks for the project
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🔧 Setting up git hooks for SpinChain..."

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ Error: Not a git repository. Please run this from the project root."
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'HOOK_EOF'
#!/bin/bash
#
# Pre-commit hook to prevent committing secrets
# This hook scans staged files for common secret patterns
#

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track if any secrets were found
SECRETS_FOUND=0

echo "🔒 Scanning for secrets in staged files..."

# Get list of staged files (excluding deleted files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No files to scan${NC}"
    exit 0
fi

# Function to check a pattern and report matches
check_pattern() {
    local FILE="$1"
    local PATTERN="$2"
    local DESCRIPTION="$3"
    local STAGED_CONTENT="$4"
    local IS_HIGH_ENTROPY="$5"
    
    if [ "$IS_HIGH_ENTROPY" = "1" ]; then
        # For high entropy, only flag if it looks like a secret assignment
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn '([A-Z_]*KEY|[A-Z_]*SECRET|[A-Z_]*TOKEN|[A-Z_]*PASSWORD|[A-Z_]*PRIVATE)\s*[=:]\s*["\047]?[a-zA-Z0-9_-]{40,}' 2>/dev/null || true)
    else
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn "$PATTERN" 2>/dev/null || true)
    fi
    
    if [ -n "$MATCHES" ]; then
        return 0
    fi
    return 1
}

# Function to print header once
print_header() {
    if [ $SECRETS_FOUND -eq 0 ]; then
        echo ""
        echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  ⚠️  POTENTIAL SECRETS DETECTED IN COMMIT${NC}"
        echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
        echo ""
    fi
}

# Check each staged file
for FILE in $STAGED_FILES; do
    # Skip binary files and certain file types
    case "$FILE" in
        *.jpg|*.jpeg|*.png|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf|*.eot|*.mp4|*.webm|*.mp3|*.pdf|*.zip|*.tar|*.gz)
            continue
            ;;
    esac
    
    # Check if file exists and is readable
    if [ ! -f "$FILE" ]; then
        continue
    fi
    
    # Get staged content of the file
    STAGED_CONTENT=$(git show ":$FILE" 2>/dev/null)
    
    if [ -z "$STAGED_CONTENT" ]; then
        continue
    fi
    
    # Check for Sui private key
    if check_pattern "$FILE" 'suiprivkey1[a-z0-9]{55,65}' "Sui private key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn 'suiprivkey1[a-z0-9]{55,65}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: Sui private key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/([=:])[[:space:]]*["\047]?[a-zA-Z0-9_-]{20,}["\047]?/\1 ***REDACTED***/gi' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for private key patterns
    if check_pattern "$FILE" '(private[_-]?key|privkey|secret[_-]?key)\s*[=:]\s*["\047]?[a-zA-Z0-9]{32,}' "Private key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn '(private[_-]?key|privkey|secret[_-]?key)\s*[=:]\s*["\047]?[a-zA-Z0-9]{32,}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: Private key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/([=:])[[:space:]]*["\047]?[a-zA-Z0-9_-]{20,}["\047]?/\1 ***REDACTED***/gi' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for API keys
    if check_pattern "$FILE" '(api[_-]?key|apikey)\s*[=:]\s*["\047]?[a-zA-Z0-9]{20,}' "API key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn '(api[_-]?key|apikey)\s*[=:]\s*["\047]?[a-zA-Z0-9]{20,}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: API key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/([=:])[[:space:]]*["\047]?[a-zA-Z0-9_-]{20,}["\047]?/\1 ***REDACTED***/gi' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for Google API keys
    if check_pattern "$FILE" 'AIza[0-9A-Za-z_-]{35}' "Google API key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn 'AIza[0-9A-Za-z_-]{35}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: Google API key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/AIza[0-9A-Za-z_-]{35}/***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for GitHub tokens
    if check_pattern "$FILE" 'gh[pousr]_[A-Za-z0-9_]{36,}' "GitHub token" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn 'gh[pousr]_[A-Za-z0-9_]{36,}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: GitHub token${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/gh[pousr]_[A-Za-z0-9_]{36,}/***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for AWS Access Key ID
    if check_pattern "$FILE" 'AKIA[0-9A-Z]{16}' "AWS Access Key ID" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn 'AKIA[0-9A-Z]{16}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: AWS Access Key ID${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/AKIA[0-9A-Z]{16}/***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for AWS Secret Key
    if check_pattern "$FILE" 'aws[_-]?secret[_-]?(access)?[_-]?key\s*[=:]\s*["\047]?[a-zA-Z0-9/+=]{40}' "AWS Secret Access Key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn 'aws[_-]?secret[_-]?(access)?[_-]?key\s*[=:]\s*["\047]?[a-zA-Z0-9/+=]{40}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: AWS Secret Access Key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/([=:])[[:space:]]*["\047]?[a-zA-Z0-9/+=]{40}["\047]?/\1 ***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for Ethereum private key (64 hex chars)
    if check_pattern "$FILE" '\b[0-9a-fA-F]{64}\b' "Potential Ethereum private key" "$STAGED_CONTENT" ""; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn '\b[0-9a-fA-F]{64}\b' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: Potential Ethereum private key${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/\b[0-9a-fA-F]{64}\b/***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
    
    # Check for high-entropy secrets (KEY=long_string patterns)
    if check_pattern "$FILE" '' "High-entropy secret" "$STAGED_CONTENT" "1"; then
        print_header
        SECRETS_FOUND=1
        MATCHES=$(echo "$STAGED_CONTENT" | grep -iEn '([A-Z_]*KEY|[A-Z_]*SECRET|[A-Z_]*TOKEN|[A-Z_]*PASSWORD|[A-Z_]*PRIVATE)\s*[=:]\s*["\047]?[a-zA-Z0-9_-]{40,}' 2>/dev/null || true)
        echo -e "${YELLOW}File: $FILE${NC}"
        echo -e "${YELLOW}Pattern: High-entropy secret${NC}"
        echo ""
        echo "$MATCHES" | head -5 | sed -E 's/([=:])[[:space:]]*["\047]?[a-zA-Z0-9_-]{20,}["\047]?/\1 ***REDACTED***/g' | sed 's/^/  /'
        echo ""
    fi
done

# Check for .env files that should not be committed
echo "$STAGED_FILES" | grep -E '^\.env\.local$|^\.env\.production$|^\.env\.development$' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    ENV_FILES=$(echo "$STAGED_FILES" | grep -E '^\.env\.local$|^\.env\.production$|^\.env\.development$')
    print_header
    for FILE in $ENV_FILES; do
        SECRETS_FOUND=1
        echo -e "${YELLOW}File '$FILE' is being committed!${NC}"
        echo "This file typically contains secrets and should not be committed."
        echo ""
    done
fi

if [ $SECRETS_FOUND -eq 1 ]; then
    echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${RED}Commit blocked! Potential secrets were detected.${NC}"
    echo ""
    echo "To proceed with this commit (if you're sure these are not secrets), run:"
    echo ""
    echo "  git commit --no-verify"
    echo ""
    echo "Or remove the secrets and commit again."
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ No secrets detected in staged files${NC}"
exit 0
HOOK_EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will scan for:"
echo "  • Private keys (Sui, Ethereum, generic)"
echo "  • API keys (Google, GitHub, AWS, generic)"
echo "  • High-entropy secrets"
echo "  • .env.local, .env.production, .env.development files"
echo ""
echo "To bypass the hook in an emergency: git commit --no-verify"
