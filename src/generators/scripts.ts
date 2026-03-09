import { chmodSync } from "node:fs";
import { join } from "node:path";
import type { ProjectConfig } from "../types";
import { createDirectory, writeFile } from "../utils/file-utils";

export function generateScripts(projectPath: string, config: ProjectConfig) {
  const scriptsPath = join(projectPath, "scripts");
  createDirectory(scriptsPath);

  if (config.includeBackend && (config.includeKV || config.includeR2)) {
    const installCloudflare = generateInstallCloudflareScript(config);
    const scriptPath = join(scriptsPath, "install-cloudflare.sh");
    writeFile(scriptPath, installCloudflare);
    chmodSync(scriptPath, 0o755);
  }

  if (config.includeGithubActions) {
    const setupGithubEnv = generateSetupGithubEnvScript(config);
    const scriptPath = join(scriptsPath, "setup-github-env.sh");
    writeFile(scriptPath, setupGithubEnv);
    chmodSync(scriptPath, 0o755);
  }
}

function generateInstallCloudflareScript(config: ProjectConfig): string {
  const resources: string[] = [];
  if (config.includeKV) resources.push("KV namespaces");
  if (config.includeR2) resources.push("R2 buckets");
  const resourcesStr = resources.join(" and ");

  let kvCreation = "";
  let r2Creation = "";
  let updateScript = "";
  const summary: string[] = [];

  if (config.includeKV) {
    kvCreation = `
echo ""
echo "Creating KV namespace for staging..."
STAGING_KV_ID=$(npx wrangler kv namespace create "KV" --env staging | grep -oP 'id = "\\K[^"]+' || echo "")

if [ -z "$STAGING_KV_ID" ]; then
    echo "❌ Failed to create staging KV namespace"
    exit 1
fi

echo "✅ Staging KV ID: $STAGING_KV_ID"

echo ""
echo "Creating KV namespace for production..."
PROD_KV_ID=$(npx wrangler kv namespace create "KV" --env production | grep -oP 'id = "\\K[^"]+' || echo "")

if [ -z "$PROD_KV_ID" ]; then
    echo "❌ Failed to create production KV namespace"
    exit 1
fi

echo "✅ Production KV ID: $PROD_KV_ID"
`;
    summary.push("  Staging KV ID:      $STAGING_KV_ID", "  Production KV ID:   $PROD_KV_ID");
  }

  if (config.includeR2) {
    r2Creation = `
echo ""
echo "Creating R2 bucket for staging..."
STAGING_R2_BUCKET="${config.name}-staging"
npx wrangler r2 bucket create "$STAGING_R2_BUCKET" || {
    echo "❌ Failed to create staging R2 bucket"
    exit 1
}
echo "✅ Staging R2 Bucket: $STAGING_R2_BUCKET"

echo ""
echo "Creating R2 bucket for production..."
PROD_R2_BUCKET="${config.name}-production"
npx wrangler r2 bucket create "$PROD_R2_BUCKET" || {
    echo "❌ Failed to create production R2 bucket"
    exit 1
}
echo "✅ Production R2 Bucket: $PROD_R2_BUCKET"
`;
    summary.push(
      "  Staging R2 Bucket:  $STAGING_R2_BUCKET",
      "  Production R2 Bucket: $PROD_R2_BUCKET",
    );
  }

  // Build the update script
  const updates: string[] = [];
  if (config.includeKV) {
    updates.push(
      "config.env.staging.kv_namespaces[0].id = '$STAGING_KV_ID';",
      "config.env.production.kv_namespaces[0].id = '$PROD_KV_ID';",
    );
  }
  if (config.includeR2) {
    updates.push(
      "config.env.staging.r2_buckets[0].bucket_name = '$STAGING_R2_BUCKET';",
      "config.env.production.r2_buckets[0].bucket_name = '$PROD_R2_BUCKET';",
    );
  }

  updateScript = `
# Update wrangler.json
$RUNTIME -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));
${updates.join("\n")}
fs.writeFileSync('wrangler.json', JSON.stringify(config, null, 2));
"
`;

  return `#!/bin/bash

# Install Cloudflare Resources
# This script creates ${resourcesStr} for staging and production environments

set -e

PROJECT_NAME="${config.name}"
BACKEND_PATH="apps/backend"

cd $BACKEND_PATH

echo "🚀 Creating Cloudflare resources..."

# Check if user is logged in
if ! npx wrangler whoami &> /dev/null; then
    echo "❌ You are not logged in to Cloudflare. Please run:"
    echo "   npx wrangler login"
    exit 1
fi
${kvCreation}${r2Creation}
echo ""
echo "📝 Updating wrangler.json..."

# Check if bun is available, otherwise use node
if command -v bun &> /dev/null; then
    RUNTIME="bun"
elif command -v node &> /dev/null; then
    RUNTIME="node"
else
    echo "❌ Neither bun nor node is installed. Please install one of them."
    exit 1
fi
${updateScript}
cd ../..

echo ""
echo "✅ Cloudflare resources created and configured!"
echo ""
echo "📋 Summary:"
${summary.join('\necho "')}
echo ""
echo "All resources have been automatically added to wrangler.json"
`;
}

function generateSetupGithubEnvScript(config: ProjectConfig): string {
  const backendSecrets: string[] = [`APP_ENV`];
  const backendVars: string[] = [];
  const frontendVars: string[] = [];

  if (config.includeDatabase) {
    backendSecrets.push(`DATABASE_URL`);
  }

  if (config.includeAuth) {
    backendSecrets.push(`BETTER_AUTH_SECRET`);
    backendVars.push(`API_ORIGIN`, `WEB_ORIGIN`);
  }

  if (config.includeBackend && config.includeFrontend) {
    frontendVars.push(`VITE_API_ORIGIN`);
  }

  return `#!/bin/bash

# Setup GitHub Environment Variables and Secrets
# This script helps you configure GitHub Actions environment variables and secrets

set -e

PROJECT_NAME="${config.name}"

echo "🔐 GitHub Environment Setup"
echo "This script will help you set up secrets and variables for GitHub Actions"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it with:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ You are not authenticated with GitHub. Please run:"
    echo "   gh auth login"
    exit 1
fi

# Get the repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [ -z "$REPO" ]; then
    echo "❌ Could not determine repository. Make sure you're in a git repository with a GitHub remote."
    exit 1
fi

echo "📦 Repository: $REPO"
echo ""

# Function to set a secret
set_secret() {
    local env=$1
    local key=$2
    local value=$3

    if [ -z "$value" ]; then
        echo "⚠️  Skipping $key (empty value)"
        return
    fi

    echo "$value" | gh secret set "$key" --env "$env" --repo "$REPO"
    echo "✅ Set secret: $key (env: $env)"
}

# Function to set a variable
set_variable() {
    local env=$1
    local key=$2
    local value=$3

    if [ -z "$value" ]; then
        echo "⚠️  Skipping $key (empty value)"
        return
    fi

    gh variable set "$key" --env "$env" --body "$value" --repo "$REPO"
    echo "✅ Set variable: $key (env: $env)"
}

# Create environments if they don't exist
echo "📋 Setting up environments..."
gh api --method PUT -H "Accept: application/vnd.github+json" \\
  "/repos/$REPO/environments/staging" &> /dev/null || true
gh api --method PUT -H "Accept: application/vnd.github+json" \\
  "/repos/$REPO/environments/production" &> /dev/null || true

echo ""
echo "🔑 Setting up Cloudflare API Token..."
read -sp "Enter CLOUDFLARE_API_TOKEN: " CLOUDFLARE_API_TOKEN
echo ""
set_secret "staging" "CLOUDFLARE_API_TOKEN" "$CLOUDFLARE_API_TOKEN"
set_secret "production" "CLOUDFLARE_API_TOKEN" "$CLOUDFLARE_API_TOKEN"

${
  config.includeBackend
    ? `
echo ""
echo "🔧 Backend Secrets (staging)..."
${backendSecrets
  .map((secret) => {
    if (secret === "APP_ENV") {
      return `set_secret "staging" "APP_ENV" "staging"`;
    }
    return `read -sp "Enter ${secret} (staging): " ${secret}_STAGING
echo ""
set_secret "staging" "${secret}" "$${secret}_STAGING"`;
  })
  .join("\n")}

echo ""
echo "🔧 Backend Secrets (production)..."
${backendSecrets
  .map((secret) => {
    if (secret === "APP_ENV") {
      return `set_secret "production" "APP_ENV" "production"`;
    }
    return `read -sp "Enter ${secret} (production): " ${secret}_PROD
echo ""
set_secret "production" "${secret}" "$${secret}_PROD"`;
  })
  .join("\n")}
${
  backendVars.length > 0
    ? `
echo ""
echo "🔧 Backend Variables (staging)..."
${backendVars
  .map(
    (variable) => `read -p "Enter ${variable} (staging): " ${variable}_STAGING
set_variable "staging" "${variable}" "$${variable}_STAGING"`,
  )
  .join("\n")}

echo ""
echo "🔧 Backend Variables (production)..."
${backendVars
  .map(
    (variable) => `read -p "Enter ${variable} (production): " ${variable}_PROD
set_variable "production" "${variable}" "$${variable}_PROD"`,
  )
  .join("\n")}
`
    : ""
}`
    : ""
}
${
  config.includeFrontend && frontendVars.length > 0
    ? `
echo ""
echo "🎨 Frontend Variables (staging)..."
${frontendVars
  .map(
    (variable) => `read -p "Enter ${variable} (staging): " ${variable}_STAGING
set_variable "staging" "${variable}" "$${variable}_STAGING"`,
  )
  .join("\n")}

echo ""
echo "🎨 Frontend Variables (production)..."
${frontendVars
  .map(
    (variable) => `read -p "Enter ${variable} (production): " ${variable}_PROD
set_variable "production" "${variable}" "$${variable}_PROD"`,
  )
  .join("\n")}
`
    : ""
}

echo ""
echo "✅ GitHub environment setup complete!"
echo ""
echo "📋 Environments configured:"
echo "  - staging"
echo "  - production"
echo ""
echo "You can view and manage these at:"
echo "https://github.com/$REPO/settings/environments"
`;
}
