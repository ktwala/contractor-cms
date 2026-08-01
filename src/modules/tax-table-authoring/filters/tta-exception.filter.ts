import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { TtaException } from '../types/error-codes';

@Catch(TtaException)
export class TtaExceptionFilter implements ExceptionFilter {
  catch(exception: TtaException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(exception.httpStatus).json({
      ok: false,
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details ?? null,
      },
    });
  }
}
