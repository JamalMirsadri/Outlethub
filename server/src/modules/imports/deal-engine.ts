import { DealLevel } from "@prisma/client";

export interface DealEvaluation {
  dealLevel: DealLevel;
  isFeatured: boolean;
  isTrending: boolean;
}

export class DealEngine {
  public evaluate(discountPercent: number): DealEvaluation {
    if (discountPercent >= 70) {
      return {
        dealLevel: DealLevel.FEATURED,
        isFeatured: true,
        isTrending: true,
      };
    }

    if (discountPercent >= 60) {
      return {
        dealLevel: DealLevel.HOT,
        isFeatured: false,
        isTrending: true,
      };
    }

    if (discountPercent >= 50) {
      return {
        dealLevel: DealLevel.GOOD,
        isFeatured: false,
        isTrending: false,
      };
    }

    return {
      dealLevel: DealLevel.NONE,
      isFeatured: false,
      isTrending: false,
    };
  }
}

export const dealEngine = new DealEngine();
