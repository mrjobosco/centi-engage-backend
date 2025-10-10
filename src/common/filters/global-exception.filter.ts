import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // Handle HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = this.getHttpErrorName(status);
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error =
          (exceptionResponse as any).error || this.getHttpErrorName(status);
      }

      // Log with appropriate severity
      if (status >= 500) {
        this.logger.error(
          `HTTP ${status} Error: ${JSON.stringify(message)}`,
          exception.stack,
        );
      } else if (status >= 400) {
        this.logger.warn(`HTTP ${status} Error: ${JSON.stringify(message)}`);
      }
    }
    // Handle Prisma errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
      error = prismaError.error;

      this.logger.error(
        `Prisma Error [${exception.code}]: ${message}`,
        exception.stack,
      );
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message || 'Internal server error';
      error = exception.name || 'Internal Server Error';

      this.logger.error(`Unhandled Error: ${message}`, exception.stack);
    }
    // Handle unknown errors
    else {
      this.logger.error(`Unknown Error: ${JSON.stringify(exception)}`);
    }

    // Return standardized error response
    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getHttpErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return errorNames[status] || 'Error';
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (exception.meta?.target as string[]) || [];
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${target.join(', ')} already exists`,
          error: 'Conflict',
        };
      }

      case 'P2025':
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };

      case 'P2003':
        // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference to related record',
          error: 'Bad Request',
        };

      case 'P2014':
        // Required relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'The change would violate a required relation',
          error: 'Bad Request',
        };

      case 'P2000':
        // Value too long for column
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'The provided value is too long',
          error: 'Bad Request',
        };

      case 'P2001':
        // Record does not exist
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The record does not exist',
          error: 'Not Found',
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          error: 'Internal Server Error',
        };
    }
  }
}
