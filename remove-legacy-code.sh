#!/bin/bash
# Legacy Code Removal Script

echo "=== Legacy Code Removal ==="
echo ""
echo "This will remove:"
echo "  - src/controllers/ (legacy Express controllers)"
echo "  - src/routes/ (legacy Express routes)"
echo "  - Legacy services (benefitPlanService, paymentBatchService, etc.)"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing legacy code..."
    
    # Remove legacy controllers
    if [ -d "src/controllers" ]; then
        rm -rf src/controllers/
        echo "✅ Removed src/controllers/"
    fi
    
    # Remove legacy routes
    if [ -d "src/routes" ]; then
        rm -rf src/routes/
        echo "✅ Removed src/routes/"
    fi
    
    # Remove legacy services
    [ -f "src/services/benefitPlanService.ts" ] && rm -f src/services/benefitPlanService.ts && echo "✅ Removed benefitPlanService.ts"
    [ -f "src/services/benefitEnrollmentService.ts" ] && rm -f src/services/benefitEnrollmentService.ts && echo "✅ Removed benefitEnrollmentService.ts"
    [ -f "src/services/benefitCalculationService.ts" ] && rm -f src/services/benefitCalculationService.ts && echo "✅ Removed benefitCalculationService.ts"
    [ -f "src/services/paymentBatchService.ts" ] && rm -f src/services/paymentBatchService.ts && echo "✅ Removed paymentBatchService.ts"
    [ -f "src/services/bankFileGenerator.ts" ] && rm -f src/services/bankFileGenerator.ts && echo "✅ Removed bankFileGenerator.ts"
    [ -f "src/services/bankAccountValidator.ts" ] && rm -f src/services/bankAccountValidator.ts && echo "✅ Removed bankAccountValidator.ts"
    
    echo ""
    echo "✅ Legacy code removed!"
    echo "Expected error reduction: 132 errors"
    echo ""
    echo "Next: Run 'npx tsc --noEmit' to verify"
else
    echo "Cancelled"
fi
