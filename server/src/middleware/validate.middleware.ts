import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validateBody(schema: ZodTypeAny) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      request.body = schema.parse(request.body);
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      request.query = schema.parse(request.query);
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      request.params = schema.parse(request.params);
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
