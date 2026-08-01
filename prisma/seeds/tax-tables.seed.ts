import { PrismaClient, Country, PackStatus, TaxTableType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import { describeDatabaseTargetFromUrl, loadRepoEnvForPrismaSeeds } from '../seed-env';

const pool = new Pool(loadRepoEnvForPrismaSeeds());
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Tax Tables Seed Script
 * 
 * This seeds the database with official tax tables.
 * Run with: npm run db:seed:tax-tables   (or: npx ts-node prisma/seeds/tax-tables.seed.ts from repo root)
 */

function generateChecksum(data: object): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
}

async function seedLesothoTaxTables() {
    console.log('🇱🇸 Seeding Lesotho tax tables...');

    // Lesotho PAYE 2025/2026 (effective from 01 April 2025)
    // Source: Revenue Services Lesotho (rsl.org.ls)
    const lsPaye2025Data = {
        brackets: [
            { min: 0, max: 74040, rate: 0.20, base_amount: 0 },
            { min: 74040, max: null, rate: 0.30, base_amount: 14808 },
        ],
        credits: {
            tax_credit: 11640, // M11,640 per annum (M970 per month)
        },
        periods_per_year: {
            WEEKLY: 52,
            BI_WEEKLY: 26,
            SEMI_MONTHLY: 24,
            MONTHLY: 12,
        },
    };

    await prisma.taxTableSet.upsert({
        where: {
            country_tableType_taxYear: {
                country: Country.LS,
                tableType: TaxTableType.PAYE,
                taxYear: '2025/2026',
            },
        },
        update: {
            effectiveFrom: new Date('2025-04-01'),
            // null = open until superseded (TaxTableSet readiness uses effective_to >= as_of)
            effectiveTo: null,
            status: PackStatus.ACTIVE,
            sourceRef: 'Revenue Services Lesotho (rsl.org.ls)',
            checksum: generateChecksum(lsPaye2025Data),
            data: lsPaye2025Data,
        },
        create: {
            country: Country.LS,
            tableType: TaxTableType.PAYE,
            taxYear: '2025/2026',
            displayName: 'Lesotho PAYE 2025/2026',
            effectiveFrom: new Date('2025-04-01'),
            effectiveTo: null,
            status: PackStatus.ACTIVE,
            sourceRef: 'Revenue Services Lesotho (rsl.org.ls)',
            checksum: generateChecksum(lsPaye2025Data),
            data: lsPaye2025Data,
        },
    });

    // Lesotho Pack Registry
    await prisma.packRegistry.upsert({
        where: {
            country_packVersion: {
                country: Country.LS,
                packVersion: 'ls-pack@2025.1',
            },
        },
        update: {
            status: PackStatus.ACTIVE,
        },
        create: {
            country: Country.LS,
            packVersion: 'ls-pack@2025.1',
            displayName: 'Lesotho Compute Pack 2025',
            description: 'Lesotho payroll computation pack for tax year 2025/2026',
            effectiveFrom: new Date('2025-04-01'),
            status: PackStatus.ACTIVE,
            artifactChecksum: 'ls_2025_v1',
            releaseNotes: 'Updated with 2025/2026 tax brackets from RSL',
        },
    });

    console.log('  ✅ Lesotho PAYE 2025/2026 seeded');
}

async function seedSouthAfricaTaxTables() {
    console.log('🇿🇦 Seeding South Africa tax tables...');

    // South Africa PAYE 2025/2026 (effective from 01 March 2025)
    // Source: SARS Budget 2025
    const zaPaye2025Data = {
        brackets: [
            { min: 0, max: 237100, rate: 0.18, base_amount: 0 },
            { min: 237100, max: 370500, rate: 0.26, base_amount: 42678 },
            { min: 370500, max: 512800, rate: 0.31, base_amount: 77362 },
            { min: 512800, max: 673000, rate: 0.36, base_amount: 121475 },
            { min: 673000, max: 857900, rate: 0.39, base_amount: 179147 },
            { min: 857900, max: 1817000, rate: 0.41, base_amount: 251258 },
            { min: 1817000, max: null, rate: 0.45, base_amount: 644489 },
        ],
        rebates: {
            primary: 17235,   // Under 65
            secondary: 9444,  // 65-74
            tertiary: 3145,   // 75+
        },
        thresholds: {
            under65: 95750,
            age65to74: 148217,
            age75plus: 165689,
        },
        periods_per_year: {
            WEEKLY: 52,
            BI_WEEKLY: 26,
            SEMI_MONTHLY: 24,
            MONTHLY: 12,
        },
    };

    await prisma.taxTableSet.upsert({
        where: {
            country_tableType_taxYear: {
                country: Country.ZA,
                tableType: TaxTableType.PAYE,
                taxYear: '2025/2026',
            },
        },
        update: {
            effectiveFrom: new Date('2025-03-01'),
            // null = open until superseded (readiness: active row must cover as_of; Feb 2026 end missed May 2026)
            effectiveTo: null,
            status: PackStatus.ACTIVE,
            sourceRef: 'SARS Budget 2025',
            checksum: generateChecksum(zaPaye2025Data),
            data: zaPaye2025Data,
        },
        create: {
            country: Country.ZA,
            tableType: TaxTableType.PAYE,
            taxYear: '2025/2026',
            displayName: 'South Africa PAYE 2025/2026',
            effectiveFrom: new Date('2025-03-01'),
            effectiveTo: null,
            status: PackStatus.ACTIVE,
            sourceRef: 'SARS Budget 2025',
            checksum: generateChecksum(zaPaye2025Data),
            data: zaPaye2025Data,
        },
    });

    // UIF Config
    const uifData = {
        employee_rate: 0.01,
        employer_rate: 0.01,
        monthly_ceiling: 17712,
        annual_ceiling: 212544,
    };

    await prisma.statutoryConfig.upsert({
        where: {
            country_configType_effectiveFrom: {
                country: Country.ZA,
                configType: 'UIF',
                effectiveFrom: new Date('2025-03-01'),
            },
        },
        update: {
            data: uifData,
            checksum: generateChecksum(uifData),
        },
        create: {
            country: Country.ZA,
            configType: 'UIF',
            effectiveFrom: new Date('2025-03-01'),
            status: PackStatus.ACTIVE,
            checksum: generateChecksum(uifData),
            data: uifData,
            sourceRef: 'SARS 2025',
        },
    });

    // SDL Config
    const sdlData = {
        rate: 0.01,
        threshold_annual: 500000,
    };

    await prisma.statutoryConfig.upsert({
        where: {
            country_configType_effectiveFrom: {
                country: Country.ZA,
                configType: 'SDL',
                effectiveFrom: new Date('2025-03-01'),
            },
        },
        update: {
            data: sdlData,
            checksum: generateChecksum(sdlData),
        },
        create: {
            country: Country.ZA,
            configType: 'SDL',
            effectiveFrom: new Date('2025-03-01'),
            status: PackStatus.ACTIVE,
            checksum: generateChecksum(sdlData),
            data: sdlData,
            sourceRef: 'SARS 2025',
        },
    });

    // MTC (Medical Tax Credit) Config
    const mtcData = {
        main_member: 364,
        first_dependant: 364,
        additional_dependants: 246,
    };

    await prisma.statutoryConfig.upsert({
        where: {
            country_configType_effectiveFrom: {
                country: Country.ZA,
                configType: 'MTC',
                effectiveFrom: new Date('2025-03-01'),
            },
        },
        update: {
            data: mtcData,
            checksum: generateChecksum(mtcData),
        },
        create: {
            country: Country.ZA,
            configType: 'MTC',
            effectiveFrom: new Date('2025-03-01'),
            status: PackStatus.ACTIVE,
            checksum: generateChecksum(mtcData),
            data: mtcData,
            sourceRef: 'SARS 2025',
        },
    });

    // South Africa Pack Registry
    await prisma.packRegistry.upsert({
        where: {
            country_packVersion: {
                country: Country.ZA,
                packVersion: 'za-pack@2025.1',
            },
        },
        update: {
            status: PackStatus.ACTIVE,
        },
        create: {
            country: Country.ZA,
            packVersion: 'za-pack@2025.1',
            displayName: 'South Africa Compute Pack 2025',
            description: 'South Africa payroll computation pack for tax year 2025/2026',
            effectiveFrom: new Date('2025-03-01'),
            status: PackStatus.ACTIVE,
            artifactChecksum: 'za_2025_v1',
            releaseNotes: 'Updated with 2025/2026 tax brackets from SARS Budget',
        },
    });

    console.log('  ✅ South Africa PAYE 2025/2026 seeded');
    console.log('  ✅ UIF, SDL, MTC configs seeded');
}

async function main() {
    console.log('\n🌱 Seeding Tax Tables...\n');

    try {
        await seedLesothoTaxTables();
        await seedSouthAfricaTaxTables();
        console.log('\n✅ All tax tables seeded successfully!\n');
    } catch (error) {
        console.error('❌ Error seeding tax tables:', error);
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P1001') {
            const target = process.env.DATABASE_URL
                ? describeDatabaseTargetFromUrl(process.env.DATABASE_URL)
                : '(DATABASE_URL unset)';
            console.error(
                `\nDatabase unreachable (P1001). Effective DATABASE_URL target: ${target}. ` +
                    'Start Postgres (e.g. npm run docker:up). Repo-root .env is loaded with override for seeds.',
            );
        }
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();
