import type { PaymentProvider } from "@prisma/client";

export interface InitializePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
}

export interface PaymentProviderResult {
  provider: PaymentProvider;
  status: "pending";
  reference: string;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  initializePayment(input: InitializePaymentInput): Promise<PaymentProviderResult>;
  confirmPayment(reference: string): Promise<{ status: "pending" | "paid" }>;
  refundPayment(reference: string, amount: number): Promise<{ status: "pending" | "refunded" }>;
  getPaymentStatus(reference: string): Promise<{ status: "pending" | "paid" | "failed" | "refunded" }>;
}
