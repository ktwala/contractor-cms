import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { initSentry } from './core/config/sentry.config';

// Initialize Sentry as early as possible
const sentryDsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV;
if (sentryDsn) {
  initSentry(sentryDsn, nodeEnv);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS - Allow frontend origins (include 127.0.0.1 - browsers treat it as different from localhost)
  const corsOrigins = configService.get(
    'CORS_ORIGINS',
    'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002'
  ).split(',');
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-reason',
      'x-readiness-gate-override',
      'x-readiness-override-justification',
      'x-financial-gate-override',
      'x-financial-override-justification',
      'x-bank-gate-override',
      'x-bank-override-justification',
      'x-gl-gate-override',
      'x-gl-override-justification',
      'x-closed-period-mutation-bypass',
      'x-closed-period-mutation-justification',
      'x-reversal-workflow-id',
      'x-payrun-correction-approval-id',
    ],
    credentials: true,
  });

  // API Versioning
  app.setGlobalPrefix('v1');

  // Rate-limit first-admin creation only. GET /bootstrap/status is polled by the admin SPA and E2E;
  // applying the same cap to the whole /bootstrap prefix caused 429s and a false "Unable to connect" UX.
  app.use(
    '/v1/bootstrap/admin',
    rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      message: { message: 'Too many bootstrap attempts. Try again in a minute.' },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation - Temporarily disabled due to circular dependency in DTOs
  // TODO: Fix circular dependency in ImportPreviewResponseDto/ImportResultDto errors property
  // const config = new DocumentBuilder()
  //   .setTitle('Hubsec Workforce Platform API (Lesotho + South Africa)')
  //   .setDescription(
  //     `Multi-country workforce platform (LS + ZA) with core payrun lifecycle, legal entities, employments,
  //     effective-dated records, maker-checker approvals (change requests), generalized tax tables,
  //     statutory exports, adjustment payruns, and RBAC permission annotations.`,
  //   )
  //   .setVersion('0.2.1')
  //   .addBearerAuth(
  //     {
  //       type: 'http',
  //       scheme: 'bearer',
  //       bearerFormat: 'JWT',
  //       description: 'JWT should include `sub`, and ideally `roles` and `permissions` claims.',
  //     },
  //     'bearerAuth',
  //   )
  //   .addTag('Auth', 'Authentication and authorization')
  //   .addTag('LegalEntities', 'Legal entity management')
  //   .addTag('PayGroups', 'Pay group configuration')
  //   .addTag('PayPeriods', 'Pay period management')
  //   .addTag('Employees', 'Employee and effective-dated record management')
  //   .addTag('PayItems', 'Pay item definitions')
  //   .addTag('Rules', 'Calculation rules')
  //   .addTag('Tax', 'Tax tables and configuration')
  //   .addTag('PayRuns', 'Payrun lifecycle management')
  //   .addTag('Approvals', 'Maker-checker change requests')
  //   .addTag('Jobs', 'Async job management')
  //   .addTag('Artifacts', 'Export artifacts')
  //   .build();

  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api', app, document);

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`
    ╔═══════════════════════════════════════════════════════════════╗
    ║     Hubsec Workforce Platform API - Lesotho + South Africa     ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Server running on: http://localhost:${port}                     ║
    ║  Swagger docs:      (temporarily disabled)                       ║
    ║  Metrics:           http://localhost:${port}/metrics             ║
    ║  Countries:         LS (Lesotho), ZA (South Africa)           ║
    ╚═══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
