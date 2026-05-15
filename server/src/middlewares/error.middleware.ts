// src/middlewares/error.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { envConfig } from '../config';
import { ErrorRequestHandler } from 'express';
import chalk from 'chalk';
import { z } from 'zod';

export class ApiError extends Error {
   statusCode: number;
   isOperational: boolean;

   constructor(statusCode: number, message: string, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      Error.captureStackTrace(this, this.constructor);
   }
}

export const notFoundHandler = (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const error = new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`
   );
   next(error);
};

export const temporarilyDisabled = (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const error = new ApiError(503, `This endpoint is temporarily disabled`);
   next(error);
};

// Improved global error handling middleware
export const errorHandler: ErrorRequestHandler = (
   err: any,
   req: Request,
   res: Response,
   next: NextFunction
): void => {
   // Log error details
   console.error('🚨 Error caught by global handler:');
   console.error('URL:', req.method, req.originalUrl);
   console.error('Error:', err);

   // Handle Zod validation errors
   if (err instanceof z.ZodError || err.name === 'ZodError') {
      res.status(400).json({
         success: false,
         message: 'Validation failed',
         errors: err.errors || err.issues,
      });
      return;
   }

   // Handle JWT errors
   if (err.name === 'JsonWebTokenError') {
      res.status(401).json({
         success: false,
         message: 'Invalid or expired token',
      });
      return;
   }

   if (err.name === 'TokenExpiredError') {
      res.status(401).json({
         success: false,
         message: 'Token has expired',
      });
      return;
   }

   // Handle Prisma errors
   if (err.code && err.code.startsWith('P')) {
      let message = 'Database operation failed';

      // Common Prisma error codes
      switch (err.code) {
         case 'P2002':
            message = 'Record already exists (unique constraint violation)';
            break;
         case 'P2025':
            message = 'Record not found';
            break;
         case 'P2003':
            message = 'Foreign key constraint violation';
            break;
      }

      res.status(400).json({
         success: false,
         message,
         ...(envConfig.MODE === 'development' && { error: err.message }),
      });
      return;
   }

   // Handle custom API errors
   if (err instanceof ApiError) {
      res.status(err.statusCode).json({
         success: false,
         message: err.message,
      });
      return;
   }

   // Handle syntax errors (malformed JSON)
   if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
         success: false,
         message: 'Invalid JSON format',
      });
      return;
   }

   // Log request details for debugging
   const chalkColor = {
      error: chalk.red,
      success: chalk.green,
      getReq: chalk.magenta,
      postReq: chalk.cyan,
   };

   const { hostname, originalUrl, protocol, method } = req;
   console.log(
      chalkColor.error('❌ ERROR'),
      `${method === 'GET' ? chalkColor.getReq(method) : chalkColor.postReq(method)} ${protocol}://${hostname}:${envConfig.PORT || 3000}${originalUrl}`
   );

   // Default error response
   const statusCode = err.statusCode || err.status || 500;
   const message =
      envConfig.MODE === 'production'
         ? 'Internal server error'
         : err.message || 'Something went wrong!';

   res.status(statusCode).json({
      success: false,
      message,
      ...(envConfig.MODE === 'development' && {
         stack: err.stack,
         error: err,
      }),
   });
};

// Helper functions for common errors
export const notFoundError = (resource: string) => {
   return new ApiError(404, `${resource} not found`);
};

export const badRequestError = (message: string) => {
   return new ApiError(400, message);
};

export const unauthorizedError = (message = 'Unauthorized access') => {
   return new ApiError(401, message);
};

export const forbiddenError = (message = 'Access forbidden') => {
   return new ApiError(403, message);
};

export const conflictError = (message: string) => {
   return new ApiError(409, message);
};

export const validationError = (message: string) => {
   return new ApiError(422, message);
};
