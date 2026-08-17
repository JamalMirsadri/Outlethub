import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { prisma } from "../src/config/prisma.js";
import { catalogService } from "../src/modules/catalog/catalog.service.js";

const suffix = `${Date.now()}`;
const currentDir = dirname(fileURLToPath(import.meta.url));
const brandName = `Test Brand ${suffix}`;
const parentCategoryName = `Test Parent ${suffix}`;
const childCategoryName = `Test Child ${suffix}`;
const productName = `Test Product ${suffix}`;
const productSku = `TEST-${suffix}`;
const csvSourceUrl = "https://example.com/test-csv-import-jacket";
const csvFixturePath = resolve(currentDir, "fixtures", "mango-outlet-sample.csv");
const csvUpdateContent = `Title,OriginalPrice,OutletPrice,SourceStore,SourceURL,Brand,Category,ProductImages,Description,Color,Size,Stock,Status,Gender
"CSV Import Jacket Updated",219,119,,"${csvSourceUrl}",Test CSV Import Brand,Test CSV Import Category,,,,"TAMANHO ÚNICO",Limited,active,`;

async function cleanup(): Promise<void> {
  await prisma.priceHistory.deleteMany({
    where: {
      OR: [
        {
          product: {
            sku: {
              startsWith: "TEST-",
            },
          },
        },
        {
          product: {
            sourceStore: {
              startsWith: "Test CSV Import",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-csv-import",
            },
          },
        },
      ],
    },
  });

  await prisma.productImage.deleteMany({
    where: {
      OR: [
        {
          product: {
            sku: {
              startsWith: "TEST-",
            },
          },
        },
        {
          product: {
            sourceStore: {
              startsWith: "Test CSV Import",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-csv-import",
            },
          },
        },
      ],
    },
  });

  await prisma.productVariant.deleteMany({
    where: {
      OR: [
        {
          product: {
            sku: {
              startsWith: "TEST-",
            },
          },
        },
        {
          product: {
            sourceStore: {
              startsWith: "Test CSV Import",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-csv-import",
            },
          },
        },
      ],
    },
  });

  await prisma.product.deleteMany({
    where: {
      OR: [
        {
          sku: {
            startsWith: "TEST-",
          },
        },
        {
          sourceStore: {
            startsWith: "Test CSV Import",
          },
        },
        {
          sourceUrl: {
            startsWith: "https://example.com/test-csv-import",
          },
        },
      ],
    },
  });

  await prisma.category.deleteMany({
    where: {
      OR: [
        {
          name: {
            startsWith: "Test ",
          },
        },
        {
          name: {
            startsWith: "Test CSV Import",
          },
        },
      ],
    },
  });

  await prisma.brand.deleteMany({
    where: {
      OR: [
        {
          name: {
            startsWith: "Test ",
          },
        },
        {
          name: {
            startsWith: "Test CSV Import",
          },
        },
      ],
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

test("catalog service imports Mango-shaped CSV rows with SourceURL upserts and preserves manual values", async () => {
  await cleanup();

  try {
    const initialCsv = readFileSync(csvFixturePath, "utf8");
    const initialResult = await catalogService.importProductsCsv({
      content: initialCsv,
      fileName: "mango-outlet-sample.csv",
    });

    assert.deepEqual(initialResult.summary, {
      total: 3,
      imported: 1,
      updated: 0,
      skipped: 1,
      failed: 1,
    });
    assert.equal(initialResult.issues.length, 2);
    assert.equal(initialResult.issues[0]?.status, "SKIPPED");
    assert.equal(initialResult.issues[1]?.status, "FAILED");

    const createdProduct = await prisma.product.findFirstOrThrow({
      where: {
        sourceUrl: csvSourceUrl,
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    assert.equal(createdProduct.name, "CSV Import Jacket");
    assert.equal(Number(createdProduct.oldPrice), 199);
    assert.equal(Number(createdProduct.outletPrice), 129);
    assert.equal(createdProduct.sourceStore, "Test CSV Import Store");
    assert.equal(createdProduct.stock, 0);
    assert.equal(createdProduct.stockStatus, "IN_STOCK");
    assert.deepEqual(createdProduct.sizes, ["XS", "S", "M"]);
    assert.deepEqual(createdProduct.colors, ["Black"]);
    assert.equal(createdProduct.images.length, 2);
    assert.equal(createdProduct.images[0]?.imageUrl, "https://example.com/test-csv-import-jacket-1.jpg");

    await prisma.product.update({
      where: { id: createdProduct.id },
      data: {
        description: "Manual description should stay",
        sourceStore: "Manual Store Override",
        gender: "manual-gender",
        stock: 4,
      },
    });

    const updateResult = await catalogService.importProductsCsv({
      content: csvUpdateContent,
      fileName: "mango-outlet-update.csv",
    });

    assert.deepEqual(updateResult.summary, {
      total: 1,
      imported: 0,
      updated: 1,
      skipped: 0,
      failed: 0,
    });

    const updatedProduct = await prisma.product.findFirstOrThrow({
      where: {
        sourceUrl: csvSourceUrl,
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    assert.equal(updatedProduct.name, "CSV Import Jacket Updated");
    assert.equal(Number(updatedProduct.oldPrice), 219);
    assert.equal(Number(updatedProduct.outletPrice), 119);
    assert.equal(updatedProduct.stock, 4);
    assert.equal(updatedProduct.stockStatus, "LOW_STOCK");
    assert.equal(updatedProduct.description, "Manual description should stay");
    assert.equal(updatedProduct.sourceStore, "Manual Store Override");
    assert.equal(updatedProduct.gender, "manual-gender");
    assert.deepEqual(updatedProduct.sizes, ["TAMANHO ÚNICO"]);
    assert.deepEqual(updatedProduct.colors, ["Black"]);
    assert.equal(updatedProduct.images.length, 2);

    const duplicateCount = await prisma.product.count({
      where: {
        sourceUrl: csvSourceUrl,
      },
    });
    assert.equal(duplicateCount, 1);
  } finally {
    await cleanup();
  }
});
