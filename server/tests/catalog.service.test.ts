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
const adidasCsvTeeSourceUrl = "https://example.com/test-adidas-woman-tee";
const adidasCsvDressSourceUrl = "https://example.com/test-adidas-woman-dress";
const csvFixturePath = resolve(currentDir, "fixtures", "mango-outlet-sample.csv");

async function cleanup(): Promise<void> {
  await prisma.procurementTask.deleteMany({
    where: {
      order: {
        orderNumber: {
          startsWith: "TEST-IMPORT-ORDER-",
        },
      },
    },
  });

  await prisma.orderItem.deleteMany({
    where: {
      order: {
        orderNumber: {
          startsWith: "TEST-IMPORT-ORDER-",
        },
      },
    },
  });

  await prisma.order.deleteMany({
    where: {
      orderNumber: {
        startsWith: "TEST-IMPORT-ORDER-",
      },
    },
  });

  await prisma.cartItem.deleteMany({
    where: {
      cart: {
        guestToken: {
          startsWith: "TEST-IMPORT-CART-",
        },
      },
    },
  });

  await prisma.cart.deleteMany({
    where: {
      guestToken: {
        startsWith: "TEST-IMPORT-CART-",
      },
    },
  });

  await prisma.review.deleteMany({
    where: {
      comment: {
        startsWith: "CSV import dependency cleanup",
      },
    },
  });

  await prisma.notification.deleteMany({
    where: {
      user: {
        email: {
          startsWith: "csv-import-test-",
        },
      },
    },
  });

  await prisma.priceAlert.deleteMany({
    where: {
      user: {
        email: {
          startsWith: "csv-import-test-",
        },
      },
    },
  });

  await prisma.wishlist.deleteMany({
    where: {
      user: {
        email: {
          startsWith: "csv-import-test-",
        },
      },
    },
  });

  await prisma.importProductResult.deleteMany({
    where: {
      sourceUrl: {
        startsWith: "https://example.com/import-result-test-",
      },
    },
  });

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
              startsWith: "Adidas Outlet Feed",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-adidas-",
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
              startsWith: "Adidas Outlet Feed",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-adidas-",
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
              startsWith: "Adidas Outlet Feed",
            },
          },
        },
        {
          product: {
            sourceUrl: {
              startsWith: "https://example.com/test-adidas-",
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
            startsWith: "Adidas Outlet Feed",
          },
        },
        {
          sourceUrl: {
            startsWith: "https://example.com/test-adidas-",
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
            startsWith: "Adidas Test ",
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
            startsWith: "Adidas Test ",
          },
        },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: "csv-import-test-",
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

test("catalog service replaces only the selected Adidas Woman scope and keeps other scopes untouched", async () => {
  await cleanup();

  try {
    const adidasBrand = await catalogService.createBrand({
      name: `Adidas Test ${suffix}`,
      isActive: true,
    });
    const mangoBrand = await catalogService.createBrand({
      name: `Adidas Test Mango ${suffix}`,
      isActive: true,
    });
    const nikeBrand = await catalogService.createBrand({
      name: `Adidas Test Nike ${suffix}`,
      isActive: true,
    });

    const womanCategory = await catalogService.createCategory({
      name: `Adidas Test Woman ${suffix}`,
      sortOrder: 0,
    });
    const manCategory = await catalogService.createCategory({
      name: `Adidas Test Man ${suffix}`,
      sortOrder: 1,
    });
    const shoesCategory = await catalogService.createCategory({
      name: `Adidas Test Shoes ${suffix}`,
      sortOrder: 2,
    });

    const createScopedProduct = async (
      sku: string,
      name: string,
      brandId: string,
      categoryId: string,
      sourceUrl: string,
    ) =>
      catalogService.createProduct({
        sku,
        name,
        brandId,
        categoryId,
        price: 120,
        oldPrice: 160,
        status: "ACTIVE",
        stock: 5,
        stockStatus: "IN_STOCK",
        sourceType: "IMPORT",
        sourceUrl,
        sourceStore: "Seed Import Scope",
      });

    await createScopedProduct(
      `TEST-ADIDAS-WOMAN-A-${suffix}`,
      `Adidas Woman Existing A ${suffix}`,
      adidasBrand.id,
      womanCategory.id,
      `https://example.com/seed-adidas-woman-a-${suffix}`,
    );
    await createScopedProduct(
      `TEST-ADIDAS-WOMAN-B-${suffix}`,
      `Adidas Woman Existing B ${suffix}`,
      adidasBrand.id,
      womanCategory.id,
      `https://example.com/seed-adidas-woman-b-${suffix}`,
    );
    await createScopedProduct(
      `TEST-MANGO-WOMAN-${suffix}`,
      `Mango Woman Existing ${suffix}`,
      mangoBrand.id,
      womanCategory.id,
      `https://example.com/seed-mango-woman-${suffix}`,
    );
    await createScopedProduct(
      `TEST-NIKE-WOMAN-${suffix}`,
      `Nike Woman Existing ${suffix}`,
      nikeBrand.id,
      womanCategory.id,
      `https://example.com/seed-nike-woman-${suffix}`,
    );
    await createScopedProduct(
      `TEST-ADIDAS-MAN-${suffix}`,
      `Adidas Man Existing ${suffix}`,
      adidasBrand.id,
      manCategory.id,
      `https://example.com/seed-adidas-man-${suffix}`,
    );
    await createScopedProduct(
      `TEST-ADIDAS-SHOES-${suffix}`,
      `Adidas Shoes Existing ${suffix}`,
      adidasBrand.id,
      shoesCategory.id,
      `https://example.com/seed-adidas-shoes-${suffix}`,
    );

    const invalidPreview = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: `Title,OriginalPrice,OutletPrice,SourceStore,SourceURL,Brand,Category,ProductImages,Description,Color,Size,Stock,Status,Gender
"Invalid Adidas Row",199,129,"Adidas Outlet Feed","not-a-url","Adidas","Woman","","Broken row","Blue","M","In stock",active,women`,
      fileName: "invalid-adidas-preview.csv",
      brandId: adidasBrand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: null,
    });

    assert.equal(invalidPreview.readyToImport, false);
    assert.equal(invalidPreview.summary.failed, 1);
    assert.equal(invalidPreview.summary.previousMatchingProductCount, 2);

    const adidasWomanBeforeImport = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: womanCategory.id,
      },
    });
    assert.equal(adidasWomanBeforeImport, 2);

    const csvContent = readFileSync(csvFixturePath, "utf8");
    const previewResult = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: adidasBrand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: null,
    });

    assert.equal(previewResult.readyToImport, true);
    assert.equal(previewResult.summary.previousMatchingProductCount, 2);
    assert.equal(previewResult.summary.failed, 0);
    assert.equal(previewResult.summary.skipped, 0);

    const importResult = await catalogService.importProductsCsv({
      mode: "IMPORT",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: adidasBrand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: null,
    });

    assert.equal(importResult.readyToImport, true);
    assert.deepEqual(importResult.summary, {
      total: 2,
      previousMatchingProductCount: 2,
      deleted: 2,
      imported: 2,
      updated: 0,
      skipped: 0,
      failed: 0,
      finalProductCount: 2,
    });

    const importedWomanProducts = await prisma.product.findMany({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: womanCategory.id,
      },
      include: {
        variants: {
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    assert.equal(importedWomanProducts.length, 2);
    assert.ok(importedWomanProducts.every((product) => product.brandId === adidasBrand.id));
    assert.ok(importedWomanProducts.every((product) => product.categoryId === womanCategory.id));

    const importedTee = await prisma.product.findFirstOrThrow({
      where: {
        sourceUrl: adidasCsvTeeSourceUrl,
      },
      include: {
        variants: {
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });

    assert.equal(importedTee.stock, 30);
    assert.equal(importedTee.stockStatus, "IN_STOCK");
    assert.deepEqual(importedTee.sizes, ["M", "S", "XS"]);
    assert.equal(importedTee.variants.length, 3);
    assert.ok(importedTee.variants.every((variant) => variant.stockQuantity === 10));

    const importedDress = await prisma.product.findFirstOrThrow({
      where: {
        sourceUrl: adidasCsvDressSourceUrl,
      },
      include: {
        variants: {
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });

    assert.equal(importedDress.stock, 5);
    assert.equal(importedDress.stockStatus, "IN_STOCK");
    assert.deepEqual(importedDress.sizes, ["TAMANHO ÚNICO"]);
    assert.equal(importedDress.variants[0]?.stockQuantity, 5);

    const mangoWomanCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: mangoBrand.id,
        categoryId: womanCategory.id,
      },
    });
    const nikeWomanCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: nikeBrand.id,
        categoryId: womanCategory.id,
      },
    });
    const adidasManCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: manCategory.id,
      },
    });
    const adidasShoesCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: shoesCategory.id,
      },
    });

    assert.equal(mangoWomanCount, 1);
    assert.equal(nikeWomanCount, 1);
    assert.equal(adidasManCount, 1);
    assert.equal(adidasShoesCount, 1);
  } finally {
    await cleanup();
  }
});

test("catalog service randomizes public listings across brands and supports global price sorting with 15-item pagination", async () => {
  await cleanup();

  try {
    const randomBrands = await Promise.all(
      ["Alpha", "Beta", "Gamma"].map((label) =>
        catalogService.createBrand({
          name: `${label} Random ${suffix}`,
          isActive: true,
        })),
    );

    const randomParentCategory = await catalogService.createCategory({
      name: `Random Parent ${suffix}`,
      sortOrder: 0,
    });
    const randomChildCategory = await catalogService.createCategory({
      name: `Random Child ${suffix}`,
      parentId: randomParentCategory.id,
      sortOrder: 0,
    });

    for (let brandIndex = 0; brandIndex < randomBrands.length; brandIndex += 1) {
      const brand = randomBrands[brandIndex];

      for (let productIndex = 0; productIndex < 6; productIndex += 1) {
        await catalogService.createProduct({
          sku: `RAND-${brandIndex}-${productIndex}-${suffix}`,
          name: `${brand.name} Product ${productIndex} ${suffix}`,
          brandId: brand.id,
          categoryId: randomChildCategory.id,
          price: 100 + brandIndex * 100 + productIndex,
          oldPrice: 150 + brandIndex * 100 + productIndex,
          status: "ACTIVE",
          stock: 10,
          stockStatus: "IN_STOCK",
          sourceType: "MANUAL",
          sizes: [productIndex % 2 === 0 ? "M" : "L"],
          colors: [productIndex % 2 === 0 ? "Black" : "Blue"],
        });
      }
    }

    const randomResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 15,
      category: randomParentCategory.slug,
      sort: "random",
      seed: `random-seed-${suffix}`,
    });

    assert.equal(randomResults.items.length, 15);
    assert.equal(randomResults.pagination.pageSize, 15);
    assert.equal(randomResults.pagination.total, 18);
    assert.equal(randomResults.pagination.totalPages, 2);
    assert.ok(new Set(randomResults.items.map((item) => item.brand.slug)).size >= 3);
    assert.ok(randomResults.items.every((item) => item.category.id === randomChildCategory.id));

    const randomPageTwo = await catalogService.listPublicProducts({
      page: 2,
      pageSize: 15,
      category: randomParentCategory.slug,
      sort: "random",
      seed: `random-seed-${suffix}`,
    });

    assert.equal(randomPageTwo.items.length, 3);
    assert.equal(
      new Set([...randomResults.items, ...randomPageTwo.items].map((item) => item.id)).size,
      18,
    );

    const priceLowResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 15,
      category: randomParentCategory.slug,
      sort: "price_low",
    });
    const lowPrices = priceLowResults.items.map((item) => item.price);
    assert.deepEqual(lowPrices, [...lowPrices].sort((left, right) => left - right));

    const priceHighResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 15,
      category: randomParentCategory.slug,
      sort: "price_high",
    });
    const highPrices = priceHighResults.items.map((item) => item.price);
    assert.deepEqual(highPrices, [...highPrices].sort((left, right) => right - left));

    const filteredResults = await catalogService.listPublicProducts({
      page: 1,
      pageSize: 15,
      category: randomParentCategory.slug,
      sort: "random",
      seed: `filter-seed-${suffix}`,
      sizes: ["M"],
      colors: ["Black"],
    });

    assert.equal(filteredResults.pagination.total, 9);
    assert.ok(
      filteredResults.items.every(
        (item) => item.sizes.includes("M") && item.colors.includes("Black"),
      ),
    );
  } finally {
    await cleanup();
  }
});

test("catalog service replaces the selected brand within the main category scope and assigns imports to the selected subcategory", async () => {
  await cleanup();

  try {
    const adidasBrand = await catalogService.createBrand({
      name: `Adidas Main Scope ${suffix}`,
      isActive: true,
    });
    const mangoBrand = await catalogService.createBrand({
      name: `Mango Main Scope ${suffix}`,
      isActive: true,
    });

    const womanCategory = await catalogService.createCategory({
      name: `Woman Main Scope ${suffix}`,
      sortOrder: 0,
    });
    const dressesCategory = await catalogService.createCategory({
      name: `Woman Dresses Scope ${suffix}`,
      parentId: womanCategory.id,
      sortOrder: 1,
    });
    const topsCategory = await catalogService.createCategory({
      name: `Woman Tops Scope ${suffix}`,
      parentId: womanCategory.id,
      sortOrder: 2,
    });
    const manCategory = await catalogService.createCategory({
      name: `Man Scope ${suffix}`,
      sortOrder: 3,
    });

    const createScopedProduct = async (
      sku: string,
      name: string,
      brandId: string,
      categoryId: string,
      sourceUrl: string,
    ) =>
      catalogService.createProduct({
        sku,
        name,
        brandId,
        categoryId,
        price: 120,
        oldPrice: 160,
        status: "ACTIVE",
        stock: 5,
        stockStatus: "IN_STOCK",
        sourceType: "IMPORT",
        sourceUrl,
        sourceStore: "Seed Import Scope",
      });

    await createScopedProduct(
      `TEST-ADIDAS-DRESS-${suffix}`,
      `Adidas Dresses Existing ${suffix}`,
      adidasBrand.id,
      dressesCategory.id,
      `https://example.com/seed-adidas-dress-${suffix}`,
    );
    await createScopedProduct(
      `TEST-ADIDAS-TOPS-${suffix}`,
      `Adidas Tops Existing ${suffix}`,
      adidasBrand.id,
      topsCategory.id,
      `https://example.com/seed-adidas-tops-${suffix}`,
    );
    await createScopedProduct(
      `TEST-MANGO-TOPS-${suffix}`,
      `Mango Tops Existing ${suffix}`,
      mangoBrand.id,
      topsCategory.id,
      `https://example.com/seed-mango-tops-${suffix}`,
    );
    await createScopedProduct(
      `TEST-ADIDAS-MAN-MAIN-${suffix}`,
      `Adidas Man Existing ${suffix}`,
      adidasBrand.id,
      manCategory.id,
      `https://example.com/seed-adidas-man-main-${suffix}`,
    );

    const csvContent = readFileSync(csvFixturePath, "utf8");
    const previewResult = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: adidasBrand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: dressesCategory.id,
    });

    assert.equal(previewResult.readyToImport, true);
    assert.equal(previewResult.summary.previousMatchingProductCount, 2);

    const importResult = await catalogService.importProductsCsv({
      mode: "IMPORT",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: adidasBrand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: dressesCategory.id,
    });

    assert.equal(importResult.summary.deleted, 2);
    assert.equal(importResult.summary.imported, 2);
    assert.equal(importResult.summary.failed, 0);

    const adidasWomanProducts = await prisma.product.findMany({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: {
          in: [dressesCategory.id, topsCategory.id],
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    assert.equal(adidasWomanProducts.length, 2);
    assert.ok(adidasWomanProducts.every((product) => product.categoryId === dressesCategory.id));

    const mangoWomanCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: mangoBrand.id,
        categoryId: topsCategory.id,
      },
    });
    const adidasManCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: adidasBrand.id,
        categoryId: manCategory.id,
      },
    });

    assert.equal(mangoWomanCount, 1);
    assert.equal(adidasManCount, 1);
  } finally {
    await cleanup();
  }
});

test("catalog service imports large CSV datasets across multiple batches without truncation", async () => {
  await cleanup();

  try {
    const brand = await catalogService.createBrand({
      name: `Large CSV Brand ${suffix}`,
      isActive: true,
    });
    const category = await catalogService.createCategory({
      name: `Large CSV Category ${suffix}`,
      sortOrder: 0,
    });

    const totalRows = 2030;
    const csvRows = Array.from({ length: totalRows }, (_, index) => {
      const rowNumber = index + 1;
      return `"Large CSV Product ${rowNumber}",199,129,"Large Feed","https://example.com/large-csv-${suffix}-${rowNumber}","Large Brand","Woman","https://example.com/large-${rowNumber}.jpg","Generated row ${rowNumber}","Blue","M","In stock",active,women`;
    });
    const csvContent = [
      "Title,OriginalPrice,OutletPrice,SourceStore,SourceURL,Brand,Category,ProductImages,Description,Color,Size,Stock,Status,Gender",
      ...csvRows,
    ].join("\n");

    const previewResult = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: csvContent,
      fileName: "large-import.csv",
      brandId: brand.id,
      mainCategoryId: category.id,
      subcategoryId: null,
    });

    assert.equal(previewResult.readyToImport, true);
    assert.equal(previewResult.summary.total, totalRows);
    assert.equal(previewResult.summary.failed, 0);

    const importResult = await catalogService.importProductsCsv({
      mode: "IMPORT",
      content: csvContent,
      fileName: "large-import.csv",
      brandId: brand.id,
      mainCategoryId: category.id,
      subcategoryId: null,
    });

    assert.equal(importResult.summary.imported, totalRows);
    assert.equal(importResult.summary.failed, 0);
    assert.equal(importResult.summary.finalProductCount, totalRows);

    const importedCount = await prisma.product.count({
      where: {
        deletedAt: null,
        brandId: brand.id,
        categoryId: category.id,
      },
    });

    assert.equal(importedCount, totalRows);
  } finally {
    await cleanup();
  }
});

test("catalog service accepts reordered generic CSV headers, localized prices, and ignores malformed image urls", async () => {
  await cleanup();

  try {
    const brand = await catalogService.createBrand({
      name: `Generic CSV Brand ${suffix}`,
      isActive: true,
    });
    const category = await catalogService.createCategory({
      name: `Generic CSV Category ${suffix}`,
      sortOrder: 0,
    });

    const csvContent = [
      " SourceURL , Title , ProductImages , OutletPrice , OriginalPrice , SourceStore , Brand , Category , Description , Color , Size , Stock , Status , Gender , ExtraColumn ",
      `"https://example.com/generic-csv-${suffix}","Generic Imported Product","https://example.com/valid-image-1.jpg|invalid-url|https://example.com/valid-image-2.jpg","999,90","1.234,56","Generic Feed","Different CSV Brand","Different CSV Category","Descricao internacional","Green","XS,S","Limited","active","women","ignored"`,
      `"https://example.com/generic-csv-empty-${suffix}","Generic Optional Product","","129","","Generic Feed","","","","","","","active","","ignored"`,
    ].join("\n");

    const previewResult = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: csvContent,
      fileName: "generic-import.csv",
      brandId: brand.id,
      mainCategoryId: category.id,
      subcategoryId: null,
    });

    assert.equal(previewResult.readyToImport, true);
    assert.equal(previewResult.summary.total, 2);
    assert.equal(previewResult.summary.failed, 0);

    const importResult = await catalogService.importProductsCsv({
      mode: "IMPORT",
      content: csvContent,
      fileName: "generic-import.csv",
      brandId: brand.id,
      mainCategoryId: category.id,
      subcategoryId: null,
    });

    assert.equal(importResult.summary.imported, 2);
    assert.equal(importResult.summary.failed, 0);

    const importedProduct = await prisma.product.findFirstOrThrow({
      where: {
        deletedAt: null,
        brandId: brand.id,
        categoryId: category.id,
        sourceUrl: `https://example.com/generic-csv-${suffix}`,
      },
      include: {
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        variants: {
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });

    assert.equal(importedProduct.brandId, brand.id);
    assert.equal(importedProduct.categoryId, category.id);
    assert.equal(importedProduct.oldPrice?.toString(), "1234.56");
    assert.equal(importedProduct.outletPrice?.toString(), "999.9");
    assert.equal(importedProduct.stock, 20);
    assert.equal(importedProduct.stockStatus, "LOW_STOCK");
    assert.deepEqual(importedProduct.sizes, ["XS", "S"]);
    assert.equal(importedProduct.images.length, 2);
    assert.deepEqual(
      importedProduct.images.map((image) => image.imageUrl),
      ["https://example.com/valid-image-1.jpg/", "https://example.com/valid-image-2.jpg/"],
    );
    assert.equal(importedProduct.variants.length, 2);
    assert.ok(importedProduct.variants.every((variant) => variant.stockQuantity === 10));

    const optionalProduct = await prisma.product.findFirstOrThrow({
      where: {
        deletedAt: null,
        brandId: brand.id,
        categoryId: category.id,
        sourceUrl: `https://example.com/generic-csv-empty-${suffix}`,
      },
      include: {
        variants: true,
        images: true,
      },
    });

    assert.equal(optionalProduct.stock, 10);
    assert.equal(optionalProduct.stockStatus, "IN_STOCK");
    assert.deepEqual(optionalProduct.sizes, []);
    assert.deepEqual(optionalProduct.colors, []);
    assert.equal(optionalProduct.variants.length, 0);
    assert.equal(optionalProduct.images.length, 0);
  } finally {
    await cleanup();
  }
});

test("catalog service replaces scoped CSV products even when linked records exist", async () => {
  await cleanup();

  try {
    const brand = await catalogService.createBrand({
      name: `Adidas Test Linked ${suffix}`,
      isActive: true,
    });

    const womanCategory = await catalogService.createCategory({
      name: `Adidas Test Linked Woman ${suffix}`,
      sortOrder: 0,
    });

    const existingProduct = await catalogService.createProduct({
      sku: `TEST-ADIDAS-LINKED-${suffix}`,
      name: `Adidas Woman Linked Existing ${suffix}`,
      brandId: brand.id,
      categoryId: womanCategory.id,
      price: 120,
      oldPrice: 160,
      status: "ACTIVE",
      stock: 5,
      stockStatus: "IN_STOCK",
      sourceType: "IMPORT",
      sourceUrl: `https://example.com/seed-adidas-linked-${suffix}`,
      sourceStore: "Seed Import Scope",
    });

    const customerRole =
      (await prisma.role.findFirst({
        where: {
          code: "CUSTOMER",
        },
      })) ??
      (await prisma.role.create({
        data: {
          code: "CUSTOMER",
          name: "Customer",
        },
      }));

    const user = await prisma.user.create({
      data: {
        roleId: customerRole.id,
        email: `csv-import-test-${suffix}@example.com`,
        referralCode: `CSVIMPORT${suffix}`,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        guestToken: `TEST-IMPORT-CART-${suffix}`,
        countryCode: "PT",
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: existingProduct.id,
        quantity: 1,
        supplierCost: 100,
        customerPaid: 120,
        profitAmount: 20,
        snapshotTitle: existingProduct.title,
      },
    });

    await prisma.wishlist.create({
      data: {
        userId: user.id,
        productId: existingProduct.id,
      },
    });

    await prisma.priceAlert.create({
      data: {
        userId: user.id,
        productId: existingProduct.id,
        targetPrice: 99,
      },
    });

    await prisma.review.create({
      data: {
        productId: existingProduct.id,
        rating: 4,
        comment: `CSV import dependency cleanup ${suffix}`,
      },
    });

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        orderNumber: `TEST-IMPORT-ORDER-${suffix}`,
        customerEmail: user.email,
        subtotal: 120,
        shippingAmount: 0,
        taxAmount: 0,
        totalAmount: 120,
        shippingAddress: {
          countryCode: "PT",
        },
      },
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: existingProduct.id,
        title: existingProduct.title,
        quantity: 1,
        unitPrice: 120,
        totalPrice: 120,
      },
    });

    const procurementTask = await prisma.procurementTask.create({
      data: {
        orderId: order.id,
        orderItemId: orderItem.id,
        productId: existingProduct.id,
        quantity: 1,
      },
    });

    const importResultLink = await prisma.importProductResult.create({
      data: {
        status: "UPDATED",
        productId: existingProduct.id,
        productName: existingProduct.title,
        sourceUrl: `https://example.com/import-result-test-${suffix}`,
      },
    });

    const csvContent = readFileSync(csvFixturePath, "utf8");
    const previewResult = await catalogService.importProductsCsv({
      mode: "PREVIEW",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: brand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: null,
    });

    assert.equal(previewResult.readyToImport, true);
    assert.equal(previewResult.summary.previousMatchingProductCount, 1);

    const importResult = await catalogService.importProductsCsv({
      mode: "IMPORT",
      content: csvContent,
      fileName: "mango-outlet-sample.csv",
      brandId: brand.id,
      mainCategoryId: womanCategory.id,
      subcategoryId: null,
    });

    assert.equal(importResult.summary.deleted, 1);
    assert.equal(importResult.summary.imported, 2);
    assert.equal(importResult.summary.failed, 0);

    assert.equal(
      await prisma.product.count({
        where: {
          id: existingProduct.id,
        },
      }),
      0,
    );
    assert.equal(await prisma.cartItem.count({ where: { productId: existingProduct.id } }), 0);
    assert.equal(await prisma.wishlist.count({ where: { productId: existingProduct.id } }), 0);
    assert.equal(await prisma.priceAlert.count({ where: { productId: existingProduct.id } }), 0);
    assert.equal(await prisma.review.count({ where: { productId: existingProduct.id } }), 0);

    const persistedOrderItem = await prisma.orderItem.findUniqueOrThrow({
      where: {
        id: orderItem.id,
      },
    });
    assert.equal(persistedOrderItem.productId, null);

    const persistedProcurementTask = await prisma.procurementTask.findUniqueOrThrow({
      where: {
        id: procurementTask.id,
      },
    });
    assert.equal(persistedProcurementTask.productId, null);

    const persistedImportProductResult = await prisma.importProductResult.findUniqueOrThrow({
      where: {
        id: importResultLink.id,
      },
    });
    assert.equal(persistedImportProductResult.productId, null);
  } finally {
    await cleanup();
  }
});
