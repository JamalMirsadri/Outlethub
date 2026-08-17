import { RoleCode } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRoles } from "../../middleware/roles.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { catalogController } from "./catalog.controller.js";
import {
  adminProductListQuerySchema,
  bulkDeleteProductsSchema,
  createBrandSchema,
  createCategorySchema,
  createProductImageSchema,
  createProductSchema,
  importProductsCsvSchema,
  createProductVariantSchema,
  entityIdParamsSchema,
  entitySlugParamsSchema,
  productImageParamsSchema,
  productVariantParamsSchema,
  publicProductListQuerySchema,
  reorderProductImagesSchema,
  toggleFeaturedSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateProductSchema,
  updateProductVariantSchema,
  uploadBrandLogoSchema,
} from "./catalog.schemas.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/products",
  validateQuery(publicProductListQuerySchema),
  asyncHandler(catalogController.listPublicProducts.bind(catalogController)),
);

catalogRouter.get(
  "/products/meta/filters",
  asyncHandler(catalogController.getCatalogFilters.bind(catalogController)),
);

catalogRouter.get(
  "/products/id/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.getPublicProductById.bind(catalogController)),
);

catalogRouter.get(
  "/products/:slug",
  validateParams(entitySlugParamsSchema),
  asyncHandler(catalogController.getPublicProductBySlug.bind(catalogController)),
);

catalogRouter.use("/admin", requireAuth, requireRoles(RoleCode.SUPER_ADMIN, RoleCode.ADMIN));

catalogRouter.get(
  "/admin/brands",
  asyncHandler(catalogController.listAdminBrands.bind(catalogController)),
);

catalogRouter.post(
  "/admin/brands",
  validateBody(createBrandSchema),
  asyncHandler(catalogController.createBrand.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/brands/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateBrandSchema),
  asyncHandler(catalogController.updateBrand.bind(catalogController)),
);

catalogRouter.delete(
  "/admin/brands/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.deleteBrand.bind(catalogController)),
);

catalogRouter.post(
  "/admin/brands/:id/logo",
  validateParams(entityIdParamsSchema),
  validateBody(uploadBrandLogoSchema),
  asyncHandler(catalogController.uploadBrandLogo.bind(catalogController)),
);

catalogRouter.get(
  "/admin/categories",
  asyncHandler(catalogController.listAdminCategories.bind(catalogController)),
);

catalogRouter.post(
  "/admin/categories",
  validateBody(createCategorySchema),
  asyncHandler(catalogController.createCategory.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/categories/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateCategorySchema),
  asyncHandler(catalogController.updateCategory.bind(catalogController)),
);

catalogRouter.delete(
  "/admin/categories/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.deleteCategory.bind(catalogController)),
);

catalogRouter.get(
  "/admin/products",
  validateQuery(adminProductListQuerySchema),
  asyncHandler(catalogController.listAdminProducts.bind(catalogController)),
);

catalogRouter.get(
  "/admin/products/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.getAdminProduct.bind(catalogController)),
);

catalogRouter.post(
  "/admin/products/import-csv",
  validateBody(importProductsCsvSchema),
  asyncHandler(catalogController.importProductsCsv.bind(catalogController)),
);

catalogRouter.post(
  "/admin/products",
  validateBody(createProductSchema),
  asyncHandler(catalogController.createProduct.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/products/:id",
  validateParams(entityIdParamsSchema),
  validateBody(updateProductSchema),
  asyncHandler(catalogController.updateProduct.bind(catalogController)),
);

catalogRouter.delete(
  "/admin/products/:id",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.deleteProduct.bind(catalogController)),
);

catalogRouter.post(
  "/admin/products/bulk-delete",
  validateBody(bulkDeleteProductsSchema),
  asyncHandler(catalogController.bulkDeleteProducts.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/products/:id/featured",
  validateParams(entityIdParamsSchema),
  validateBody(toggleFeaturedSchema),
  asyncHandler(catalogController.setFeatured.bind(catalogController)),
);

catalogRouter.get(
  "/admin/products/:id/price-history",
  validateParams(entityIdParamsSchema),
  asyncHandler(catalogController.listPriceHistory.bind(catalogController)),
);

catalogRouter.post(
  "/admin/products/:id/variants",
  validateParams(entityIdParamsSchema),
  validateBody(createProductVariantSchema),
  asyncHandler(catalogController.createVariant.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/products/:id/variants/:variantId",
  validateParams(productVariantParamsSchema),
  validateBody(updateProductVariantSchema),
  asyncHandler(catalogController.updateVariant.bind(catalogController)),
);

catalogRouter.delete(
  "/admin/products/:id/variants/:variantId",
  validateParams(productVariantParamsSchema),
  asyncHandler(catalogController.deleteVariant.bind(catalogController)),
);

catalogRouter.post(
  "/admin/products/:id/images",
  validateParams(entityIdParamsSchema),
  validateBody(createProductImageSchema),
  asyncHandler(catalogController.uploadProductImage.bind(catalogController)),
);

catalogRouter.delete(
  "/admin/products/:id/images/:imageId",
  validateParams(productImageParamsSchema),
  asyncHandler(catalogController.deleteProductImage.bind(catalogController)),
);

catalogRouter.patch(
  "/admin/products/:id/images/reorder",
  validateParams(entityIdParamsSchema),
  validateBody(reorderProductImagesSchema),
  asyncHandler(catalogController.reorderProductImages.bind(catalogController)),
);
