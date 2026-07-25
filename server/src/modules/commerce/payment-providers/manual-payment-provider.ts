import { PaymentProvider } from "@prisma/client";

import type { InitializePaymentInput, PaymentProviderAdapter } from "./payment-provider.js";

export class ManualPaymentProvider implements PaymentProviderAdapter {
  public readonly provider = PaymentProvider.MANUAL;

  public async initializePayment(input: InitializePaymentInput) {
    return {
      provider: this.provider,
      status: "pending" as const,
      reference: `manual-${input.orderId}`,
    };
  }

  public async confirmPayment(_reference: string) {
    return {
      status: "pending" as const,
    };
  }

  public async refundPayment(_reference: string, _amount: number) {
    return {
      status: "pending" as const,
    };
  }

  public async getPaymentStatus(_reference: string) {
    return {
      status: "pending" as const,
    };
  }
}

export const manualPaymentProvider = new ManualPaymentProvider();
