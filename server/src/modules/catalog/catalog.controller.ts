import type { Request, Response } from "express";

import { CatalogService, catalogService } from "./catalog.service.js";

function getParam(request: Request, key: string): string {
  const value = request.params[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route param: ${key}`);
  }

  return value;
}

export class CatalogController {
  public async listAdminBrands(_request: Request, response: Response) {
    const brands = await catalogService.listAdminBrands();
    response.status(200).json({ items: brands });
  }

  public async createBrand(request: Request, response: Response) {
    const brand = await catalogService.createBrand(request.body);
    response.status(201).json(brand);
  }

  public async updateBrand(request: Request, response: Response) {
    const brand = await catalogService.updateBrand(getParam(request, "id"), request.body);
    response.status(200).json(brand);
  }

  public async deleteBrand(request: Request, response: Response) {
    await catalogService.deleteBrand(getParam(request, "id"));
    response.status(204).send();
  }

  public async uploadBrandLogo(request: Request, response: Response) {
    const brand = await catalogService.uploadBrandLogo(getParam(request, "id"), request.body);
    response.status(200).json(brand);
  }

  public async listAdminCategories(_request: Request, response: Response) {
    const categories = await catalogService.listAdminCategories();
    response.status(200).json({ items: categories });
  }

  public async createCategory(request: Request, response: Response) {
    const category = await catalogService.createCategory(request.body);
    response.status(201).json(category);
  }

  public async updateCategory(request: Request, response: Response) {
    const category = await catalogService.updateCategory(getParam(request, "id"), request.body);
    response.status(200).json(category);
  }

  public async deleteCategory(request: Request, response: Response) {
    await catalogService.deleteCategory(getParam(request, "id"));
    response.status(204).send();
  }

  public async listAdminProducts(request: Request, response: Response) {
    const result = await catalogService.listAdminProducts(
      request.query as unknown as Parameters<CatalogService["listAdminProducts"]>[0],
    );
    response.status(200).json(result);
  }

  public async getAdminProduct(request: Request, response: Response) {
    const product = await catalogService.getAdminProduct(getParam(request, "id"));
    response.status(200).json(product);
  }

  public async importProductsCsv(request: Request, response: Response) {
    const result = await catalogService.importProductsCsv(request.body);
    response.status(200).json(result);
  }

  public async createProduct(request: Request, response: Response) {
    const product = await catalogService.createProduct(request.body);
    response.status(201).json(product);
  }

  public async updateProduct(request: Request, response: Response) {
    const product = await catalogService.updateProduct(getParam(request, "id"), request.body);
    response.status(200).json(product);
  }

  public async deleteProduct(request: Request, response: Response) {
    await catalogService.deleteProduct(getParam(request, "id"));
    response.status(204).send();
  }

  public async setFeatured(request: Request, response: Response) {
    const result = await catalogService.setFeatured(getParam(request, "id"), request.body.isFeatured);
    response.status(200).json(result);
  }

  public async listPriceHistory(request: Request, response: Response) {
    const history = await catalogService.listPriceHistory(getParam(request, "id"));
    response.status(200).json({ items: history });
  }

  public async createVariant(request: Request, response: Response) {
    const variant = await catalogService.createVariant(getParam(request, "id"), request.body);
    response.status(201).json(variant);
  }

  public async updateVariant(request: Request, response: Response) {
    const variant = await catalogService.updateVariant(
      getParam(request, "id"),
      getParam(request, "variantId"),
      request.body,
    );
    response.status(200).json(variant);
  }

  public async deleteVariant(request: Request, response: Response) {
    await catalogService.deleteVariant(getParam(request, "id"), getParam(request, "variantId"));
    response.status(204).send();
  }

  public async uploadProductImage(request: Request, response: Response) {
    const image = await catalogService.uploadProductImage(getParam(request, "id"), request.body);
    response.status(201).json(image);
  }

  public async deleteProductImage(request: Request, response: Response) {
    await catalogService.deleteProductImage(getParam(request, "id"), getParam(request, "imageId"));
    response.status(204).send();
  }

  public async reorderProductImages(request: Request, response: Response) {
    const images = await catalogService.reorderProductImages(getParam(request, "id"), request.body);
    response.status(200).json({ items: images });
  }

  public async listPublicProducts(request: Request, response: Response) {
    const result = await catalogService.listPublicProducts(
      request.query as unknown as Parameters<CatalogService["listPublicProducts"]>[0],
    );
    response.status(200).json(result);
  }

  public async getPublicProductBySlug(request: Request, response: Response) {
    const result = await catalogService.getPublicProductBySlug(getParam(request, "slug"));
    response.status(200).json(result);
  }

  public async getPublicProductById(request: Request, response: Response) {
    const result = await catalogService.getPublicProductById(getParam(request, "id"));
    response.status(200).json(result);
  }

  public async getCatalogFilters(_request: Request, response: Response) {
    const result = await catalogService.getCatalogFilters();
    response.status(200).json(result);
  }
}

export const catalogController = new CatalogController();
