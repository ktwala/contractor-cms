import * as fs from 'fs';
import * as path from 'path';

console.log('Running Governance Drift Prevention Check...');

function resolveProjectRoot(): string {
    const cwd = process.cwd();
    if (cwd.endsWith('scripts')) return path.join(cwd, '..');
    if (cwd.endsWith('backend')) return path.join(cwd, '..');
    return cwd;
}

const projectRoot = resolveProjectRoot();
const DOCS_DIR = path.join(projectRoot, 'docs');
const BUSINESS_DOCS_DIR = path.join(DOCS_DIR, 'business');
const SECURITY_DOCS_DIR = path.join(DOCS_DIR, 'security');

const CANONICAL_STATES = ['ALLOW', 'WARN', 'APPROVAL_REQUIRED', 'HOLD', 'BLOCK'];
const CANONICAL_REVERSIBILITY = ['REVERSIBLE_AFTER_CURE', 'REVERSIBLE_AFTER_APPROVAL', 'IRREVERSIBLE_NEW_TRANSACTION_REQUIRED'];
const CANONICAL_ORDER_REGEX = /Supplier(.*?)Contractor(.*?)PO(.*?)Financial/s;

let hasError = false;

function reportError(msg: string) {
    console.error(`❌ DRIFT DETECTED: ${msg}`);
    hasError = true;
}

// 1. Validate ADR-006 and GOVERNANCE_SCHEMA_INVARIANTS for precedence order
const adr006Path = path.join(BUSINESS_DOCS_DIR, 'ADR-006-Master-Policy-Decision-Hierarchy.md');
const invariantsPath = path.join(SECURITY_DOCS_DIR, 'GOVERNANCE_SCHEMA_INVARIANTS.md');

function checkPrecedence(filePath: string) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (!CANONICAL_ORDER_REGEX.test(content)) {
            reportError(`Canonical precedence order (Supplier → Contractor → PO → Financial) not found or out of order in ${path.basename(filePath)}`);
        }
    }
}

checkPrecedence(adr006Path);
checkPrecedence(invariantsPath);

// 2. Validate PDP Reason Code Catalog
const catalogPath = path.join(SECURITY_DOCS_DIR, 'PDP_REASON_CODE_CATALOG.md');
const registeredCodes = new Set<string>();

if (!fs.existsSync(catalogPath)) {
    reportError('PDP_REASON_CODE_CATALOG.md is missing.');
} else {
    const content = fs.readFileSync(catalogPath, 'utf8');
    const lines = content.split('\n');
    let inTable = false;

    lines.forEach((line, index) => {
        if (line.trim().startsWith('|') && line.includes('Reason Code')) {
            inTable = true;
            return;
        }
        if (inTable && line.trim() === '') {
            inTable = false;
        }

        if (inTable && line.includes('`') && line.split('|').length > 5) {
            // Process row
            const parts = line.split('|').map(p => p.trim());
            const codeRaw = parts[1]; // e.g. `SUPPLIER_MASTER_EXPIRED`
            const reversibilityRaw = parts[4];

            if (codeRaw && codeRaw.includes('`')) {
                const code = codeRaw.replace(/`/g, '');
                
                if (registeredCodes.has(code)) {
                    reportError(`Duplicate reason code found in catalog: ${code}`);
                }
                registeredCodes.add(code);

                if (reversibilityRaw) {
                    const rev = reversibilityRaw.replace(/`/g, '');
                    if (!CANONICAL_REVERSIBILITY.includes(rev)) {
                        reportError(`Non-canonical reversibility value "${rev}" for code ${code} on line ${index + 1}. Must be one of: ${CANONICAL_REVERSIBILITY.join(', ')}`);
                    }
                }
            }
        }
    });
}

// 3. Scan all business and security docs for non-canonical terminology
function scanDocsForTerminology(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        if (file.endsWith('.md')) {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            if (content.match(/\bVendor\b/i)) {
                reportError(`Non-canonical terminology 'Vendor' used in ${file}. Use 'Supplier'.`);
            }
        }
    });
}

scanDocsForTerminology(BUSINESS_DOCS_DIR);
scanDocsForTerminology(SECURITY_DOCS_DIR);

// 4. Runtime Drift: Prevent raw string reason codes in backend TS files not in the catalog
function scanBackendForDrift(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanBackendForDrift(fullPath);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Simplified check: if any known code is misspelled or we find `reason_code: "UNKNOWN"`
            // Since we enforce registered codes, we extract any string assigned to reason_code.
            const regex = /reason_code\s*:\s*['"]([^'"]+)['"]/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const code = match[1];
                if (!registeredCodes.has(code)) {
                    reportError(`Runtime drift: Unknown reason code '${code}' used in ${file}. Must be added to PDP_REASON_CODE_CATALOG.md first.`);
                }
            }
        }
    });
}

const BACKEND_SRC_DIR = path.join(projectRoot, 'backend/src');
scanBackendForDrift(BACKEND_SRC_DIR);

// ============================================================================
// 5. PDP Permission Format Regression — No dot-notation PDP permissions
// ============================================================================
console.log('Checking PDP permission format regression...');

function scanForDotNotationPermissions(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanForDotNotationPermissions(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Match dot-notation PDP permissions: pdp.something.something
            const dotPatterns = content.match(/['"]pdp\.[a-z]+\.[a-z]+['"]/g);
            if (dotPatterns) {
                dotPatterns.forEach((p: string) => {
                    reportError(`Dot-notation PDP permission "${p}" found in ${file}. Must use colon format (e.g., 'pdp-activation:view'). See ADR-009.`);
                });
            }
            // Also catch governance dot-notation
            const govDotPatterns = content.match(/['"]governance\.[a-z]+\.[a-z]+['"]/g);
            if (govDotPatterns) {
                govDotPatterns.forEach((p: string) => {
                    reportError(`Dot-notation governance permission "${p}" found in ${file}. Must use colon format (e.g., 'governance-analytics:view').`);
                });
            }
        }
    });
}

scanForDotNotationPermissions(BACKEND_SRC_DIR);
scanForDotNotationPermissions(path.join(projectRoot, 'frontend'));

// ============================================================================
// 6. Controller Path Regression — No double v1 prefix
// ============================================================================
console.log('Checking controller path regression...');

function scanForDoublePrefix(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanForDoublePrefix(fullPath);
        } else if (file.endsWith('.controller.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // The global prefix is api/v1, so @Controller('v1/...') creates api/v1/v1/...
            const doublePrefix = content.match(/@Controller\s*\(\s*['"]v1\//g);
            if (doublePrefix) {
                reportError(`Controller double-prefix detected in ${file}: @Controller('v1/...') will produce /api/v1/v1/... routes. Remove the 'v1/' prefix.`);
            }
        }
    });
}

scanForDoublePrefix(BACKEND_SRC_DIR);

// ============================================================================
// 7. Auth Token Key Regression — Frontend services must use 'auth_token'
// ============================================================================
console.log('Checking auth token key regression...');

const FRONTEND_SERVICES_DIR = path.join(projectRoot, 'frontend/services');
const FRONTEND_COMPONENTS_DIR = path.join(projectRoot, 'frontend/components');

function scanForWrongTokenKey(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanForWrongTokenKey(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // The canonical key is 'auth_token'. Catch wrong variants.
            if (content.includes("getItem('authToken')") || content.includes('getItem("authToken")')) {
                reportError(`Wrong auth token key 'authToken' found in ${file}. Must use 'auth_token' to match auth-context.tsx.`);
            }
        }
    });
}

scanForWrongTokenKey(FRONTEND_SERVICES_DIR);
scanForWrongTokenKey(FRONTEND_COMPONENTS_DIR);
scanForWrongTokenKey(path.join(projectRoot, 'frontend/lib'));

// ============================================================================
// 8. Governance Surface Gate — Sidebar routes must have page files
// ============================================================================
console.log('Checking governance surface gate...');

const GOVERNANCE_ROUTES = [
    { path: '/settings/pdp-activation', name: 'Governance Activation' },
    { path: '/settings/pdp-exceptions', name: 'Governance Exceptions' },
];

GOVERNANCE_ROUTES.forEach(route => {
    const pagePath = path.join(projectRoot, 'frontend/app', route.path, 'page.tsx');
    if (!fs.existsSync(pagePath)) {
        reportError(`Governance surface "${route.name}" is registered in sidebar but page file is missing: ${pagePath}`);
    }
});

// ============================================================================
// 9. Docker Proxy Regression — next.config.js must use BACKEND_URL
// ============================================================================
console.log('Checking Docker proxy regression...');

const nextConfigPath = path.join(projectRoot, 'frontend/next.config.js');
if (fs.existsSync(nextConfigPath)) {
    const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
    if (nextConfig.includes("'http://localhost:3000'") && !nextConfig.includes('BACKEND_URL')) {
        reportError(`next.config.js has hardcoded localhost:3000 without BACKEND_URL env var fallback. This breaks Docker networking.`);
    }
    // Ensure /api prefix is preserved in the destination
    if (nextConfig.includes("destination:") && !nextConfig.match(/destination:.*\/api\/:path/)) {
        reportError(`next.config.js rewrite destination must preserve '/api' prefix. Found rewrite that strips it, causing 404s.`);
    }
}

const dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
if (fs.existsSync(dockerComposePath)) {
    const compose = fs.readFileSync(dockerComposePath, 'utf8');
    if (!compose.includes('BACKEND_URL')) {
        reportError(`docker-compose.yml is missing BACKEND_URL environment variable for frontend service.`);
    }
    // Check critical volume mounts
    const requiredMounts = ['./frontend/services:', './frontend/pages:'];
    requiredMounts.forEach(mount => {
        if (!compose.includes(mount)) {
            reportError(`docker-compose.yml is missing volume mount '${mount}' for frontend service.`);
        }
    });
}

// ============================================================================
// 10. Nested Layout Regression — Settings pages must not wrap in DashboardLayout
// ============================================================================
console.log('Checking nested DashboardLayout regression...');

const SETTINGS_APP_DIR = path.join(projectRoot, 'frontend/app/settings');
if (fs.existsSync(SETTINGS_APP_DIR)) {
    const settingsSubdirs = fs.readdirSync(SETTINGS_APP_DIR);
    settingsSubdirs.forEach((subdir: string) => {
        const subdirPath = path.join(SETTINGS_APP_DIR, subdir);
        if (!fs.statSync(subdirPath).isDirectory()) return;

        // Check for nested layout.tsx files (would cause double sidebar)
        const nestedLayout = path.join(subdirPath, 'layout.tsx');
        if (fs.existsSync(nestedLayout)) {
            const content = fs.readFileSync(nestedLayout, 'utf8');
            if (content.includes('DashboardLayout')) {
                reportError(`Nested DashboardLayout in ${subdir}/layout.tsx will cause double sidebar. Remove it — settings/layout.tsx already provides the layout.`);
            }
        }

        // Check page.tsx for DashboardLayout imports
        const pageFile = path.join(subdirPath, 'page.tsx');
        if (fs.existsSync(pageFile)) {
            const content = fs.readFileSync(pageFile, 'utf8');
            if (content.includes('DashboardLayout')) {
                reportError(`Settings page ${subdir}/page.tsx imports DashboardLayout. This causes double sidebar — remove it. The parent settings/layout.tsx already provides the layout.`);
            }
        }
    });
}

// ============================================================================
// 11. Org-scoped domain controllers — @RequiresOrgContext (PermissionsGuard)
// ============================================================================
console.log('Checking org-context decorators on critical domain controllers...');

const ORG_CONTEXT_CRITICAL_CONTROLLERS = [
    'backend/src/domain/suppliers/suppliers.controller.ts',
    'backend/src/domain/contractors/contractors.controller.ts',
    'backend/src/domain/contracts/contracts.controller.ts',
    'backend/src/domain/engagements/engagements.controller.ts',
];

ORG_CONTEXT_CRITICAL_CONTROLLERS.forEach((relPath) => {
    const absPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(absPath)) {
        reportError(`Expected controller missing: ${relPath}`);
        return;
    }
    const src = fs.readFileSync(absPath, 'utf8');
    if (!src.includes('RequiresOrgContext')) {
        reportError(
            `${relPath} must use @RequiresOrgContext on routes guarded by PermissionsGuard so org-scoped roles receive targetOrganizationId (prevents false 403 for valid permissions).`,
        );
    }
});

if (hasError) {
    console.error('\n❌ Governance Drift Check Failed. See errors above.');
    process.exit(1);
} else {
    console.log('\n✅ Governance Schema verified. No drift detected.');
    process.exit(0);
}
