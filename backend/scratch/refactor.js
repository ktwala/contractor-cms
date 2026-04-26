const fs = require('fs');
const path = require('path');

const domainDir = path.join(__dirname, '../src/domain');

function processServiceFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not exists
  if (!content.includes('AccessContext')) {
    content = `import { AccessContext } from '../../core/auth/interfaces/access-context.interface';\n` + content;
  }

  // Replace method signatures
  // Matches: async methodName(organizationId: string,
  // Replace: async methodName(accessContext: AccessContext,
  content = content.replace(
    /async (\w+)\(\s*organizationId:\s*string,/g,
    'async $1(accessContext: AccessContext,'
  );

  // For where: { organizationId } -> where: accessContext.isGlobalAccess ? {} : { organizationId: accessContext.targetOrganizationId }
  // This is too complex for regex because where clauses vary.
  // Instead, replace all usages of `organizationId` (except in property names or args)
  // with `accessContext.targetOrganizationId`. Wait, we also need to handle global access.
  // This is too fragile to automate blindly.
  // I will just change the parameter to `accessContext` and extract `const organizationId = accessContext.targetOrganizationId;`
  // And for global access, the script won't fix it completely, I'll need to manually review them.

  // Let's do a simple parameter swap and inject a line:
  content = content.replace(
    /async (\w+)\(\s*accessContext:\s*AccessContext,\s*(.*?)\)\s*(:\s*Promise<.*?>)?\s*\{/g,
    (match, p1, p2, p3) => {
      const returnType = p3 || '';
      return `async ${p1}(accessContext: AccessContext, ${p2})${returnType} {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId && !accessContext.isGlobalAccess) throw new Error("Org context required");
    // TODO: implement isGlobalAccess
    const organizationId = targetOrgId; // Temporary backward compatibility`;
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.service.ts')) {
      processServiceFile(fullPath);
    }
  }
}

walk(domainDir);
console.log('Services refactored.');
