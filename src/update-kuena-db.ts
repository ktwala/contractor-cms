import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://payroll:payroll_secret@localhost:5432/payroll_platform",
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const employee = await prisma.employee.findFirst({
      where: { firstName: 'Kuena', lastName: 'Mahase' },
    });

    if (!employee) {
      console.error('Employee Kuena Mahase not found!');
      return;
    }

    console.log(`Found employee Kuena Mahase with ID: ${employee.id}`);

    // 1. Clear TIN in TaxProfile
    const taxProfileUpdate = await prisma.taxProfile.updateMany({
      where: { employeeId: employee.id },
      data: { tin: null },
    });
    console.log(`Cleared TIN for ${taxProfileUpdate.count} TaxProfile records.`);

    // 2. Update Bank Account details
    const bankAccountUpdate = await prisma.bankAccount.updateMany({
      where: { employeeId: employee.id },
      data: {
        bankName: 'Standard Lesotho Bank - City Branch',
        branchCode: '060667',
        maskedAccountNumber: '9080007195571',
        accountNumberEnc: 'encrypted_kuena_9080007195571',
      },
    });
    console.log(`Updated bank details for ${bankAccountUpdate.count} BankAccount records.`);

    // Log the updated status
    const updatedEmployee = await prisma.employee.findFirst({
      where: { id: employee.id },
      include: {
        taxProfiles: true,
        bankAccounts: true,
      }
    });
    console.log('--- Updated Employee Details ---');
    console.log(JSON.stringify(updatedEmployee, null, 2));

  } catch (error) {
    console.error('Error updating database:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
