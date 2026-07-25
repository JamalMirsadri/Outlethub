import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";

import { ApiError } from "../utils/api-error.js";

export function requireRoles(...roles: RoleCode[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(new ApiError(401, "Authentication is required."));
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(new ApiError(403, "You do not have permission to access this resource."));
      return;
    }

    next();
  };
}
