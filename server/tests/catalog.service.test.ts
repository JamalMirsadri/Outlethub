import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../src/config/prisma.js";
import { catalogService } from "../src/modules/catalog/catalog.service.js";

const suffix = `${Date.now()}`;
const brandName = `Test Brand ${suffix}`;
const parentCategoryName = `Test Parent ${suffix}`;
const childCategoryName = `Test Child ${suffix}`;
const productName = `Test Product ${suffix}`;
const productSku = `TEST-${suffix}`;

async function cleanup(): Promise<void> {
  await prisma.priceHistory.deleteMany({
    where: {
      product: {
        sku: {
          startsWith: "TEST-",
        },
      },
    },
  });

  await prisma.productImage.deleteMany({
    where: {
      product: {
        sku: {
          startsWith: "TEST-",
        },
      },
    },
  });

  await prisma.productVariant.deleteMany({
    where: {
      product: {
        sku: {
          startsWith: "TEST-",
        },
      },
    },
  });

  await prisma.product.deleteMany({
    where: {
      sku: {
        startsWith: "TEST-",
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      name: {
        startsWith: "Test ",
      },
    },
  });

  await prisma.brand.deleteMany({
    where: {
      name: {
        startsWith: "Test ",
      },
    },
  });
}

test("catalog service covers Sprint 2 CRUD, image upload, search, and filters", async () => {
  await cleanup();

  try {
    const brand = await catalogService.createBrand({
      name: brandName,
      isActive: true,
      isFeatured: true,
      isLuxury: true,
      marginPercent: 18,
    });

    assert.ok(brand.id);
    assert.equal(brand.name, brandName);

    const updatedBrand = await catalogService.updateBrand(brand.id, {
      website: "https://example.com",
      description: "Updated brand description",
    });

    assert.equal(updatedBrand.website, "https://example.com");

    const parentCategory = await catalogService.createCategory({
      name: parentCategoryName,
      sortOrder: 0,
    });

    const childCategory = await catalogService.createCategory({
      name: childCategoryName,
      parentId: parentCategory.id,
      sortOrder: 1,
    });

    const updatedCategory = await catalogService.updateCategory(childCategory.id, {
      description: "Nested test category",
    });

    assert.equal(updatedCategory.parentId, parentCategory.id);

    const createdProduct = await catalogService.createProduct({
      sku: productSku,
      name: productName,
      brandId: brand.id,
      categoryId: childCategory.id,
      price: 149,
      oldPrice: 199,
      status: "ACTIVE",
      stock: 4,
      stockStatus: "IN_STOCK",
      sourceType: "MANUAL",
      variants: [
        {
          size: "M",
          color: "Black",
          stockQuantity: 4,
        },
      ],
    });

    assert.equal(createdProduct.name, productName);
    assert.equal(createdProduct.brand.name, brandName);

    const image = await catalogService.uploadProductImage(createdProduct.id, {
      imageUrl: "https://example.com/catalog-test.jpg",
    });

    assert.equal(image.imageUrl, "https://example.com/catalog-test.jpg");

    const updatedProduct = await catalogService.updateProduct(createdProduct.id, {
      price: 129,
      oldPrice: 189,
      discountPercent: 32,
      stock: 6,
      sourceStore: "OutletHub Test Feed",
      sourceUrl: "https://example.com/products/test",
    });

    assert.equal(updatedProduct.price, 129);
    assert.equal(updatedProduct.sourceStore, "OutletHub Test Feed");

    const history = await catalogService.listPriceHistory(createdProduct.id);
    assert.ok(history.length >= 2);

    const searchResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 12,
      search: productName,
      sort: "newest",
    });

    assert.equal(searchResults.items.length, 1);

    const brandResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 12,
      brand: brand.slug,
      sort: "newest",
    });

    assert.equal(brandResults.items[0]?.brand.name, brandName);

    const categoryResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 12,
      category: childCategory.slug,
      sort: "newest",
    });

    assert.equal(categoryResults.items[0]?.category.slug, childCategory.slug);

    const discountResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 12,
      minDiscount: 30,
      sort: "discount",
    });

    assert.ok(discountResults.items.some((item) => item.id === createdProduct.id));

    await catalogService.deleteProduct(createdProduct.id);
    const archived = await catalogService.getAdminProduct(createdProduct.id);
    assert.equal(archived.status, "ARCHIVED");
  } finally {
    await cleanup();
  }
});
