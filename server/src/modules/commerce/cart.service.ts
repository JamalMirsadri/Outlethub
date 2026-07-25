import { CartType, Prisma, ProductStatus, StockStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { createRandomToken } from "../../utils/crypto.js";
import { pricingService } from "./pricing.service.js";

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(value);
}

const CART_ITEM_INCLUDE = {
  product: {
    include: {
      brand: true,
      images: {
        orderBy: { sortOrder: "asc" as const },
        take: 1,
      },
    },
  },
  variant: true,
} satisfies Prisma.CartItemInclude;

const CART_INCLUDE = {
  items: {
    include: CART_ITEM_INCLUDE,
    orderBy: { createdAt: "asc" as const },
  },
  shippingMethod: true,
} satisfies Prisma.CartInclude;

type CartWithRelations = Prisma.CartGetPayload<{
  include: typeof CART_INCLUDE;
}>;

export class CartService {
  private async getDefaultCartMetadata(countryCode?: string | null) {
    const settings = await pricingService.getBusinessSettings();
    return {
      currency: settings.defaultCurrency,
      countryCode: countryCode ?? settings.defaultCountryCode,
    };
  }

  private async createGuestCart(countryCode?: string | null) {
    const defaults = await this.getDefaultCartMetadata(countryCode);
    const cart = await prisma.cart.create({
      data: {
        type: CartType.GUEST,
        guestToken: createRandomToken(24),
        currency: defaults.currency,
        countryCode: defaults.countryCode,
      },
      include: CART_INCLUDE,
    });

    return cart;
  }

  public async resolveCart(input: {
    userId?: string | null;
    guestToken?: string | null;
    countryCode?: string | null;
    createIfMissing?: boolean;
  }): Promise<{ cart: CartWithRelations | null; guestToken: string | null }> {
    const createIfMissing = input.createIfMissing ?? true;

    if (input.userId) {
      const existingUserCart = await prisma.cart.findFirst({
        where: {
          userId: input.userId,
        },
        include: CART_INCLUDE,
        orderBy: { createdAt: "asc" },
      });

      if (existingUserCart) {
        return {
          cart: existingUserCart,
          guestToken: null,
        };
      }

      if (!createIfMissing) {
        return {
          cart: null,
          guestToken: null,
        };
      }

      const defaults = await this.getDefaultCartMetadata(input.countryCode);
      const created = await prisma.cart.create({
        data: {
          type: CartType.USER,
          userId: input.userId,
          currency: defaults.currency,
          countryCode: defaults.countryCode,
        },
        include: CART_INCLUDE,
      });

      return {
        cart: created,
        guestToken: null,
      };
    }

    if (input.guestToken) {
      const guestCart = await prisma.cart.findUnique({
        where: {
          guestToken: input.guestToken,
        },
        include: CART_INCLUDE,
      });

      if (guestCart) {
        return {
          cart: guestCart,
          guestToken: guestCart.guestToken,
        };
      }
    }

    if (!createIfMissing) {
      return {
        cart: null,
        guestToken: input.guestToken ?? null,
      };
    }

    const createdGuestCart = await this.createGuestCart(input.countryCode);
    return {
      cart: createdGuestCart,
      guestToken: createdGuestCart.guestToken,
    };
  }

  private mapCart(cart: CartWithRelations | null) {
    if (!cart) {
      return {
        id: null,
        itemCount: 0,
        currency: "EUR",
        countryCode: "PT",
        subtotalAmount: 0,
        shippingAmount: 0,
        handlingAmount: 0,
        paymentFeeAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        items: [],
        shippingMethod: null,
      };
    }

    return {
      id: cart.id,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      currency: cart.currency,
      countryCode: cart.countryCode,
      subtotalAmount: toNumber(cart.subtotalAmount),
      shippingAmount: toNumber(cart.shippingAmount),
      handlingAmount: toNumber(cart.handlingAmount),
      paymentFeeAmount: toNumber(cart.paymentFeeAmount),
      taxAmount: toNumber(cart.taxAmount),
      totalAmount: toNumber(cart.totalAmount),
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        currency: item.currency,
        supplierCost: toNumber(item.supplierCost),
        customerPaid: toNumber(item.customerPaid),
        profitAmount: toNumber(item.profitAmount),
        title: item.snapshotTitle,
        brand: item.snapshotBrand,
        imageUrl: item.snapshotImageUrl,
        sourceUrl: item.snapshotSourceUrl,
        size: item.variant?.size ?? null,
        color: item.variant?.color ?? null,
        product: {
          id: item.product.id,
          slug: item.product.slug,
          name: item.product.name,
          brand: item.product.brand.name,
          stockStatus: item.product.stockStatus,
          imageUrl: item.product.images[0]?.imageUrl ?? null,
        },
      })),
      shippingMethod: cart.shippingMethod
        ? {
            id: cart.shippingMethod.id,
            name: cart.shippingMethod.name,
            countryCode: cart.shippingMethod.countryCode,
            originCountryCode: cart.shippingMethod.originCountryCode,
            baseFee: toNumber(cart.shippingMethod.baseFee),
            minWeightKg: toNumber(cart.shippingMethod.minWeightKg),
            maxWeightKg: toNumber(cart.shippingMethod.maxWeightKg),
            minDeliveryDays: cart.shippingMethod.minDeliveryDays,
            maxDeliveryDays: cart.shippingMethod.maxDeliveryDays,
            deliveryEstimate: cart.shippingMethod.deliveryEstimate,
          }
        : null,
    };
  }

  private async recalculateCart(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: true,
        shippingMethod: true,
      },
    });

    if (!cart) {
      throw new ApiError(404, "Cart not found.");
    }

    const totals = await pricingService.calculateCartTotals({
      items: cart.items.map((item) => ({
        quantity: item.quantity,
        customerPaid: item.customerPaid,
        unitWeightKg: 1,
      })),
      countryCode: cart.countryCode,
      shippingMethodId: cart.shippingMethodId,
    });

    return prisma.cart.update({
      where: { id: cart.id },
      data: {
        currency: totals.currency,
        subtotalAmount: totals.subtotalAmount,
        shippingAmount: totals.shippingAmount,
        handlingAmount: totals.handlingAmount,
        paymentFeeAmount: totals.paymentFeeAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
      },
      include: CART_INCLUDE,
    });
  }

  public async getCart(input: {
    userId?: string | null;
    guestToken?: string | null;
    createIfMissing?: boolean;
  }) {
    const resolved = await this.resolveCart(input);
    return {
      cart: this.mapCart(resolved.cart),
      guestToken: resolved.guestToken,
    };
  }

  public async addItem(input: {
    userId?: string | null;
    guestToken?: string | null;
    productId: string;
    variantId?: string | null;
    quantity: number;
  }) {
    const resolved = await this.resolveCart({
      userId: input.userId,
      guestToken: input.guestToken,
      createIfMissing: true,
    });

    if (!resolved.cart) {
      throw new ApiError(500, "Cart could not be created.");
    }

    const product = await prisma.product.findFirst({
      where: {
        id: input.productId,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
      },
      include: {
        brand: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    if (product.stockStatus === StockStatus.OUT_OF_STOCK) {
      throw new ApiError(409, "This product is currently out of stock.");
    }

    if (input.variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: input.variantId,
          productId: product.id,
        },
      });

      if (!variant) {
        throw new ApiError(404, "Product variant not found.");
      }
    }

    const pricing = await pricingService.calculateProductPricing({
      id: product.id,
      brandId: product.brandId,
      categoryId: product.categoryId,
      supplierPrice: product.supplierPrice,
      fallbackPrice: product.price,
      currency: product.currency,
      useCustomPricing: product.useCustomPricing,
      customPrice: product.customPrice,
    }, resolved.cart.countryCode);

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: resolved.cart.id,
        productId: product.id,
        variantId: input.variantId ?? null,
      },
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + input.quantity,
          supplierCost: pricing.supplierPrice,
          customerPaid: pricing.customerPrice,
          profitAmount: pricing.profitAmount,
          snapshotTitle: product.name,
          snapshotBrand: product.brand.name,
          snapshotImageUrl: product.images[0]?.imageUrl ?? null,
          snapshotSourceUrl: product.sourceUrl,
          currency: pricing.currency,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: resolved.cart.id,
          productId: product.id,
          variantId: input.variantId ?? null,
          quantity: input.quantity,
          supplierCost: pricing.supplierPrice,
          customerPaid: pricing.customerPrice,
          profitAmount: pricing.profitAmount,
          snapshotTitle: product.name,
          snapshotBrand: product.brand.name,
          snapshotImageUrl: product.images[0]?.imageUrl ?? null,
          snapshotSourceUrl: product.sourceUrl,
          currency: pricing.currency,
        },
      });
    }

    const cart = await this.recalculateCart(resolved.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: resolved.guestToken,
    };
  }

  public async updateItem(input: {
    userId?: string | null;
    guestToken?: string | null;
    itemId: string;
    quantity: number;
  }) {
    const resolved = await this.resolveCart({
      userId: input.userId,
      guestToken: input.guestToken,
      createIfMissing: false,
    });

    if (!resolved.cart) {
      throw new ApiError(404, "Cart not found.");
    }

    const item = await prisma.cartItem.findFirst({
      where: {
        id: input.itemId,
        cartId: resolved.cart.id,
      },
    });

    if (!item) {
      throw new ApiError(404, "Cart item not found.");
    }

    if (input.quantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: item.id },
      });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: {
          quantity: input.quantity,
        },
      });
    }

    const cart = await this.recalculateCart(resolved.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: resolved.guestToken,
    };
  }

  public async removeItem(input: {
    userId?: string | null;
    guestToken?: string | null;
    itemId: string;
  }) {
    const resolved = await this.resolveCart({
      userId: input.userId,
      guestToken: input.guestToken,
      createIfMissing: false,
    });

    if (!resolved.cart) {
      throw new ApiError(404, "Cart not found.");
    }

    const item = await prisma.cartItem.findFirst({
      where: {
        id: input.itemId,
        cartId: resolved.cart.id,
      },
    });

    if (!item) {
      throw new ApiError(404, "Cart item not found.");
    }

    await prisma.cartItem.delete({
      where: { id: item.id },
    });

    const cart = await this.recalculateCart(resolved.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: resolved.guestToken,
    };
  }

  public async clearCart(input: {
    userId?: string | null;
    guestToken?: string | null;
  }) {
    const resolved = await this.resolveCart({
      userId: input.userId,
      guestToken: input.guestToken,
      createIfMissing: false,
    });

    if (!resolved.cart) {
      return {
        cart: this.mapCart(null),
        guestToken: resolved.guestToken,
      };
    }

    await prisma.cartItem.deleteMany({
      where: {
        cartId: resolved.cart.id,
      },
    });

    const cart = await this.recalculateCart(resolved.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: resolved.guestToken,
    };
  }

  public async mergeGuestCartIntoUser(input: {
    userId: string;
    guestToken?: string | null;
  }) {
    const [userCartResult, guestCartResult] = await Promise.all([
      this.resolveCart({
        userId: input.userId,
        createIfMissing: true,
      }),
      this.resolveCart({
        guestToken: input.guestToken,
        createIfMissing: false,
      }),
    ]);

    if (!userCartResult.cart) {
      throw new ApiError(500, "User cart could not be created.");
    }

    if (!guestCartResult.cart || guestCartResult.cart.id === userCartResult.cart.id) {
      return {
        cart: this.mapCart(userCartResult.cart),
        guestToken: null,
      };
    }

    for (const guestItem of guestCartResult.cart.items) {
      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: userCartResult.cart.id,
          productId: guestItem.productId,
          variantId: guestItem.variantId,
        },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + guestItem.quantity,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: userCartResult.cart.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
            quantity: guestItem.quantity,
            currency: guestItem.currency,
            supplierCost: guestItem.supplierCost,
            customerPaid: guestItem.customerPaid,
            profitAmount: guestItem.profitAmount,
            snapshotTitle: guestItem.snapshotTitle,
            snapshotBrand: guestItem.snapshotBrand,
            snapshotImageUrl: guestItem.snapshotImageUrl,
            snapshotSourceUrl: guestItem.snapshotSourceUrl,
          },
        });
      }
    }

    await prisma.cart.delete({
      where: { id: guestCartResult.cart.id },
    });

    await prisma.cart.update({
      where: { id: userCartResult.cart.id },
      data: {
        lastMergedAt: new Date(),
      },
    });

    const cart = await this.recalculateCart(userCartResult.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: null,
    };
  }

  public async updateCartCountry(input: {
    userId?: string | null;
    guestToken?: string | null;
    countryCode: string;
    shippingMethodId?: string | null;
  }) {
    const resolved = await this.resolveCart({
      userId: input.userId,
      guestToken: input.guestToken,
      createIfMissing: true,
      countryCode: input.countryCode,
    });

    if (!resolved.cart) {
      throw new ApiError(500, "Cart could not be resolved.");
    }

    await prisma.cart.update({
      where: { id: resolved.cart.id },
      data: {
        countryCode: input.countryCode,
        shippingMethodId: input.shippingMethodId ?? null,
      },
    });

    const cart = await this.recalculateCart(resolved.cart.id);
    return {
      cart: this.mapCart(cart),
      guestToken: resolved.guestToken,
    };
  }
}

export const cartService = new CartService();
