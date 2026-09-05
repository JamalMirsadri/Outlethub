import type { Request, Response } from "express";

import { shippingService } from "./shipping.service.js";

function getAuthUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return userId;
}

export class ShippingController {
  public async getShippingConfig(_request: Request, response: Response) {
    response.status(200).json(await shippingService.getShippingConfig());
  }

  public async updateShippingConfig(request: Request, response: Response) {
    response.status(200).json(
      await shippingService.updateShippingConfig(getAuthUserId(request), request.body),
    );
  }
}

export const shippingController = new ShippingController();
