import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient, StockStatus } from "@prisma/client";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:5176";
const API_BASE_URL = "http://127.0.0.1:4002/api/v1";
const ARTIFACT_DIR = path.join(process.cwd(), "artifacts", "sprint8-final");
const ADMIN_EMAIL = "admin@outlethub.local";
const ADMIN_PASSWORD = "Admin12345!";
const CUSTOMER_PASSWORD = "Customer12345!";
const RATE_VALUE = 184000;
const DEBUG_SESSION_ID = "payment-runtime-blockers";
const DEBUG_SERVER_URL = "http://127.0.0.1:7777/event";

const prisma = new PrismaClient();

// #region debug-point C:verification-harness
async function reportDebugEvent(payload) {
  try {
    await fetch(DEBUG_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        source: "script:sprint8-final-verify",
        ...payload,
      }),
    });
  } catch {
    // Ignore debug transport failures.
  }
}
// #endregion debug-point C:verification-harness

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureArtifacts() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });

  const pngPath = path.join(ARTIFACT_DIR, "receipt-image.png");
  const pdfPath = path.join(ARTIFACT_DIR, "receipt-document.pdf");

  const tinyPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sWwaP8AAAAASUVORK5CYII=";
  const tinyPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 18 Tf
72 96 Td
(Sprint 8 Receipt PDF) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000245 00000 n 
0000000350 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
420
%%EOF`;

  await fs.writeFile(pngPath, Buffer.from(tinyPngBase64, "base64"));
  await fs.writeFile(pdfPath, tinyPdf, "utf8");

  return { pngPath, pdfPath };
}

async function waitForHttp(url, expectedStatus = 200, timeoutMs = 30000) {
  const startedAt = Date.now();

  // #region debug-point C:wait-for-http-start
  await reportDebugEvent({
    hypothesisId: "C",
    message: "[DEBUG] waitForHttp start",
    data: {
      url,
      expectedStatus,
      timeoutMs,
    },
  });
  // #endregion debug-point C:wait-for-http-start

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      // #region debug-point C:wait-for-http-response
      await reportDebugEvent({
        hypothesisId: "C",
        message: "[DEBUG] waitForHttp response",
        data: {
          url,
          status: response.status,
        },
      });
      // #endregion debug-point C:wait-for-http-response
      if (response.status === expectedStatus) {
        return;
      }
    } catch (error) {
      // #region debug-point C:wait-for-http-error
      await reportDebugEvent({
        hypothesisId: "C",
        message: "[DEBUG] waitForHttp error",
        data: {
          url,
          error: error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) },
        },
      });
      // #endregion debug-point C:wait-for-http-error
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function screenshot(page, name) {
  const outputPath = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

async function apiRequest(page, routePath, { method = "GET", body = null, auth = true } = {}) {
  // #region debug-point C:api-request-start
  await reportDebugEvent({
    hypothesisId: "C",
    message: "[DEBUG] apiRequest start",
    data: {
      routePath,
      method,
      auth,
    },
  });
  // #endregion debug-point C:api-request-start

  return page.evaluate(
    async ({ apiBaseUrl, routePath: pathValue, method: httpMethod, body: payload, auth: useAuth }) => {
      const token = useAuth ? window.localStorage.getItem("outlethub_access_token") : null;
      const response = await fetch(`${apiBaseUrl}${pathValue}`, {
        method: httpMethod,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const raw = await response.text();
      let data = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    {
      apiBaseUrl: API_BASE_URL,
      routePath,
      method,
      body,
      auth,
    },
  );
}

async function waitForJsonResponse(responsePromise, context) {
  const response = await responsePromise;
  const raw = await response.text();

  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  assert(response.ok(), `${context} failed with ${response.status()}: ${JSON.stringify(data)}`);
  return data;
}

function expectOk(result, context) {
  assert(result.ok, `${context} failed with ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.evaluate(
    async ({ apiBaseUrl, userEmail, userPassword }) => {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          password: userPassword,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.accessToken) {
        throw new Error(payload?.message ?? `Login failed with status ${response.status}`);
      }

      window.localStorage.setItem("outlethub_access_token", payload.accessToken);
    },
    {
      apiBaseUrl: API_BASE_URL,
      userEmail: email,
      userPassword: password,
    },
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
}

async function registerCustomer(customerEmail) {
  // #region debug-point A:register-customer-start
  await reportDebugEvent({
    hypothesisId: "A",
    message: "[DEBUG] Harness registerCustomer start",
    data: {
      customerEmail,
      apiBaseUrl: API_BASE_URL,
    },
  });
  // #endregion debug-point A:register-customer-start

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: customerEmail,
      password: CUSTOMER_PASSWORD,
      confirmPassword: CUSTOMER_PASSWORD,
    }),
  });

  const data = await response.json();
  // #region debug-point A:register-customer-response
  await reportDebugEvent({
    hypothesisId: response.status >= 500 ? "A" : "C",
    message: "[DEBUG] Harness registerCustomer response",
    data: {
      customerEmail,
      status: response.status,
      ok: response.ok,
      data,
    },
  });
  // #endregion debug-point A:register-customer-response
  assert(response.ok, `Customer registration failed: ${JSON.stringify(data)}`);
  return data;
}

function resolveProductSelection(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  assert(items.length > 0, "No products are available for Sprint 8 verification.");

  const [primaryProduct, secondaryProduct] = items;
  return {
    primaryProduct,
    secondaryProduct: secondaryProduct ?? primaryProduct,
  };
}

async function ensurePurchasableProducts(products) {
  const uniqueProducts = Array.from(
    new Map(products.map((product) => [product.id, product])).values(),
  );

  for (const product of uniqueProducts) {
    if ((product.stock ?? 0) > 0) {
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: 12,
        stockStatus: StockStatus.IN_STOCK,
      },
    });

    product.stock = 12;
    product.stockStatus = StockStatus.IN_STOCK;
  }
}

async function setFileInput(page, labelText, filePath) {
  const field = page.locator("div").filter({ hasText: labelText }).first();
  await field.locator("input[type='file']").setInputFiles(filePath);
}

async function main() {
  // #region debug-point C:main-start
  await reportDebugEvent({
    hypothesisId: "C",
    message: "[DEBUG] Sprint 8 verification main start",
    data: {
      baseUrl: BASE_URL,
      apiBaseUrl: API_BASE_URL,
    },
  });
  // #endregion debug-point C:main-start

  const { pngPath, pdfPath } = await ensureArtifacts();

  await waitForHttp(`${API_BASE_URL}/health`);
  await waitForHttp(BASE_URL);

  const uniqueSuffix = Date.now();
  const customerEmail = `sprint8.customer.${uniqueSuffix}@outlethub.local`;
  const bankName = `Sprint 8 QA Bank ${uniqueSuffix}`;
  const customerReferenceApproved = `SPRINT8-APPROVE-${uniqueSuffix}`;
  const customerReferenceRejected = `SPRINT8-REJECT-${uniqueSuffix}`;

  const productCatalogResponse = await fetch(`${API_BASE_URL}/products?limit=5`);
  const productCatalogPayload = await productCatalogResponse.json();
  assert(productCatalogResponse.ok, `Product catalog lookup failed: ${JSON.stringify(productCatalogPayload)}`);
  const { primaryProduct, secondaryProduct } = resolveProductSelection(productCatalogPayload);
  await ensurePurchasableProducts([primaryProduct, secondaryProduct]);

  await registerCustomer(customerEmail);

  const browser = await chromium.launch({ headless: true });
  const adminContext = await browser.newContext({ acceptDownloads: true });
  const customerContext = await browser.newContext({ acceptDownloads: true });
  const adminPage = await adminContext.newPage();
  const customerPage = await customerContext.newPage();

  const evidence = {
    baseUrl: BASE_URL,
    apiBaseUrl: API_BASE_URL,
    artifacts: {},
    customerEmail,
    adminEmail: ADMIN_EMAIL,
    bankAccount: null,
    exchangeRate: null,
    products: {
      primary: {
        id: primaryProduct.id,
        name: primaryProduct.name,
        slug: primaryProduct.slug,
      },
      secondary: {
        id: secondaryProduct.id,
        name: secondaryProduct.name,
        slug: secondaryProduct.slug,
      },
    },
    checkoutSnapshot: null,
    approvedFlow: null,
    rejectedFlow: null,
  };

  try {
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    const bankAccountResponse = await apiRequest(adminPage, "/admin/bank-accounts", {
      method: "POST",
      body: {
        bankName,
        accountHolder: "OutletHub Payments",
        iban: "PT50000201231234567890154",
        accountNumber: "1234567890",
        cardNumber: "6037991234567890",
        swift: "OUTLPTPL",
        country: "Portugal",
        currency: "EUR",
        notes: "Sprint 8 verification account",
        isActive: true,
      },
    });
    evidence.bankAccount = expectOk(bankAccountResponse, "Bank account upsert");

    const exchangeRateResponse = await apiRequest(adminPage, "/admin/exchange-rates", {
      method: "POST",
      body: {
        baseCurrency: "EUR",
        quoteCurrency: "TOMAN",
        rate: RATE_VALUE,
        notes: "Sprint 8 verification rate",
        isActive: true,
      },
    });
    evidence.exchangeRate = expectOk(exchangeRateResponse, "Exchange rate upsert");

    await adminPage.goto(`${BASE_URL}/admin/bank-accounts`, { waitUntil: "networkidle" });
    await adminPage.getByText(bankName).waitFor({ timeout: 15000 });
    evidence.artifacts.adminBankAccounts = await screenshot(adminPage, "admin-bank-accounts");

    await adminPage.goto(`${BASE_URL}/admin/exchange-rates`, { waitUntil: "networkidle" });
    await adminPage.getByText("EUR").first().waitFor({ timeout: 15000 });
    evidence.artifacts.adminExchangeRates = await screenshot(adminPage, "admin-exchange-rates");

    await adminPage.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
    evidence.artifacts.adminPaymentsInitial = await screenshot(adminPage, "admin-payments-initial");

    await login(customerPage, customerEmail, CUSTOMER_PASSWORD);

    await customerPage.goto(`${BASE_URL}/shop`, { waitUntil: "networkidle" });
    await customerPage.getByText(primaryProduct.name).first().waitFor({ timeout: 15000 });
    evidence.artifacts.customerCatalogEur = await screenshot(customerPage, "customer-catalog-eur");

    await customerPage.goto(`${BASE_URL}/products/${primaryProduct.slug}`, { waitUntil: "networkidle" });
    await customerPage.getByText(primaryProduct.name).first().waitFor({ timeout: 15000 });
    evidence.artifacts.customerProductEur = await screenshot(customerPage, "customer-product-eur");
    await customerPage.getByRole("button", { name: "ADD TO BAG" }).click();
    await customerPage.waitForTimeout(1200);

    const addressResponse = await apiRequest(customerPage, "/addresses", {
      method: "POST",
      body: {
        fullName: "Sprint 8 Customer",
        phone: "+989121234567",
        countryCode: "IR",
        city: "Tehran",
        postalCode: "1599814713",
        addressLine1: "Valiasr Street, No. 100",
        addressLine2: "Unit 12",
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    });
    expectOk(addressResponse, "Customer address create");

    const cartCountryResponse = await apiRequest(customerPage, "/cart/country", {
      method: "PATCH",
      body: {
        countryCode: "IR",
      },
    });
    expectOk(cartCountryResponse, "Cart country update");

    const currencyPreferenceResponse = await apiRequest(customerPage, "/currencies/preference", {
      method: "PATCH",
      body: {
        currency: "TOMAN",
      },
    });
    expectOk(currencyPreferenceResponse, "Preferred currency update");

    await customerPage.goto(`${BASE_URL}/cart`, { waitUntil: "networkidle" });
    await customerPage.getByText("Your bag").waitFor({ timeout: 15000 });
    evidence.artifacts.customerCartToman = await screenshot(customerPage, "customer-cart-toman");

    await customerPage.goto(`${BASE_URL}/shop`, { waitUntil: "networkidle" });
    evidence.artifacts.customerCatalogToman = await screenshot(customerPage, "customer-catalog-toman");

    await customerPage.goto(`${BASE_URL}/products/${primaryProduct.slug}`, { waitUntil: "networkidle" });
    evidence.artifacts.customerProductToman = await screenshot(customerPage, "customer-product-toman");

    await customerPage.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
    await customerPage.getByText("Checkout").waitFor({ timeout: 15000 });

    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByText("Sprint 8 Customer").waitFor({ timeout: 15000 });
    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();

    await customerPage.getByText(bankName).waitFor({ timeout: 15000 });
    evidence.artifacts.customerCheckoutBankTransfer = await screenshot(customerPage, "customer-checkout-bank-transfer");

    const checkoutSummaryResponse = await apiRequest(customerPage, "/checkout");
    evidence.checkoutSnapshot = expectOk(checkoutSummaryResponse, "Checkout summary fetch");

    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();
    const firstOrderResponsePromise = customerPage.waitForResponse(
      (response) =>
        response.url().includes("/checkout/orders") &&
        response.request().method() === "POST",
    );
    await customerPage.getByRole("button", { name: "Place Order", exact: true }).click();
    const firstOrder = await waitForJsonResponse(firstOrderResponsePromise, "First order create");
    evidence.approvedFlow = {
      order: firstOrder,
    };
    await customerPage.goto(`${BASE_URL}/dashboard/payments`, { waitUntil: "networkidle" });
    await customerPage.waitForLoadState("networkidle");

    const approvedPaymentCard = customerPage
      .locator("div.rounded-xl.border.border-border.p-5")
      .filter({ hasText: firstOrder.orderNumber })
      .first();
    await approvedPaymentCard.waitFor({ timeout: 20000 });
    await approvedPaymentCard.locator("input").first().fill(customerReferenceApproved);
    await approvedPaymentCard.locator("textarea").fill("Sprint 8 approved receipt");
    await approvedPaymentCard.locator("input[type='file']").setInputFiles(pngPath);
    const approvedUploadResponsePromise = customerPage.waitForResponse(
      (response) =>
        response.url().includes("/payments/") &&
        response.url().includes("/receipt") &&
        response.request().method() === "POST",
    );
    await approvedPaymentCard.getByRole("button", { name: "Upload Receipt" }).click();
    await waitForJsonResponse(approvedUploadResponsePromise, "Approved receipt upload");
    await customerPage.getByText("PAYMENT PENDING REVIEW").waitFor({ timeout: 20000 });
    evidence.artifacts.customerPaymentPendingReview = await screenshot(customerPage, "customer-payment-pending-review");

    const paymentsAfterUploadResponse = await apiRequest(customerPage, "/payments");
    const paymentsAfterUpload = expectOk(
      paymentsAfterUploadResponse,
      "Customer payments after receipt upload",
    ).items;
    const approvedCandidate = paymentsAfterUpload.find((payment) => payment.paymentReference === customerReferenceApproved);
    assert(approvedCandidate, "Approved candidate payment was not created.");

    const receiptPreviewUrl = approvedCandidate.receiptUrl;
    assert(receiptPreviewUrl, "Receipt URL was not saved.");

    const receiptPreviewResponse = await fetch(receiptPreviewUrl);
    const receiptPreviewBuffer = await receiptPreviewResponse.arrayBuffer();
    assert(receiptPreviewResponse.ok, `Receipt preview failed with ${receiptPreviewResponse.status}.`);
    evidence.approvedFlow = {
      ...evidence.approvedFlow,
      initialPayment: approvedCandidate,
      receiptPreview: {
        url: receiptPreviewUrl,
        status: receiptPreviewResponse.status,
        contentType: receiptPreviewResponse.headers.get("content-type"),
        sizeBytes: receiptPreviewBuffer.byteLength,
      },
    };

    const receiptPreviewPage = await customerContext.newPage();
    await receiptPreviewPage.goto(receiptPreviewUrl, { waitUntil: "networkidle" });
    evidence.artifacts.receiptPreviewImage = await screenshot(receiptPreviewPage, "receipt-preview-image");
    await receiptPreviewPage.close();

    await adminPage.goto(`${BASE_URL}/admin/payments/review`, { waitUntil: "networkidle" });
    const approvedReviewCard = adminPage.locator("div.rounded-xl.border").filter({ hasText: customerReferenceApproved }).first();
    await approvedReviewCard.waitFor({ timeout: 20000 });
    await approvedReviewCard.locator("textarea").fill("Approved during Sprint 8 verification");
    evidence.artifacts.adminPaymentReviewQueue = await screenshot(adminPage, "admin-payment-review-queue");
    const approvedReviewResponsePromise = adminPage.waitForResponse(
      (response) =>
        response.url().includes(`/admin/payments/${approvedCandidate.id}/review`) &&
        response.request().method() === "PATCH",
    );
    await approvedReviewCard.getByRole("button", { name: "Approve Payment" }).click();
    const approvedReviewResult = await waitForJsonResponse(
      approvedReviewResponsePromise,
      "Approve payment review",
    );
    evidence.approvedFlow.reviewResponse = approvedReviewResult;

    await adminPage.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
    await adminPage.getByText(firstOrder.orderNumber).waitFor({ timeout: 15000 });
    await customerPage.reload({ waitUntil: "networkidle" });
    await customerPage.getByText("PAYMENT APPROVED", { exact: true }).first().waitFor({ timeout: 20000 });
    evidence.artifacts.customerPaymentApproved = await screenshot(customerPage, "customer-payment-approved");

    const approvedPaymentRow = adminPage.locator("tr").filter({ hasText: firstOrder.orderNumber }).first();
    await approvedPaymentRow.waitFor({ timeout: 15000 });
    await approvedPaymentRow.getByText("PAYMENT APPROVED").waitFor({ timeout: 15000 });
    evidence.artifacts.adminPaymentsApproved = await screenshot(adminPage, "admin-payments-approved");

    const approvedOrderAfterReview = await prisma.order.findUnique({
      where: {
        id: firstOrder.id,
      },
      select: {
        id: true,
        status: true,
        paidAt: true,
      },
    });
    assert(approvedOrderAfterReview, "Approved order was not found after review.");
    evidence.approvedFlow.orderAfterApproval = approvedOrderAfterReview;

    const completePaymentResponsePromise = adminPage.waitForResponse(
      (response) =>
        response.url().includes(`/admin/payments/${approvedCandidate.id}/complete`) &&
        response.request().method() === "PATCH",
    );
    await approvedPaymentRow.getByRole("button", { name: "Complete Payment" }).click();
    const approvedCompletionResult = await waitForJsonResponse(
      completePaymentResponsePromise,
      "Complete payment",
    );
    evidence.approvedFlow.completionResponse = approvedCompletionResult;

    await adminPage.getByText("PAID").first().waitFor({ timeout: 20000 });
    evidence.artifacts.adminPaymentsCompleted = await screenshot(adminPage, "admin-payments-completed");

    await customerPage.reload({ waitUntil: "networkidle" });
    await customerPage.getByText("PAID").waitFor({ timeout: 20000 });
    evidence.artifacts.customerPaymentPaid = await screenshot(customerPage, "customer-payment-paid");

    await customerPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await customerPage.getByText("My Orders").waitFor({ timeout: 15000 });
    evidence.artifacts.customerOrders = await screenshot(customerPage, "customer-orders");

    const approvedPaymentDb = await prisma.payment.findFirst({
      where: {
        paymentReference: customerReferenceApproved,
      },
      include: {
        order: true,
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: { actorUser: true },
        },
      },
    });
    assert(approvedPaymentDb, "Approved payment not found in database.");

    evidence.approvedFlow.finalPayment = {
      id: approvedPaymentDb.id,
      status: approvedPaymentDb.status,
      approvedAt: approvedPaymentDb.approvedAt,
      rejectedAt: approvedPaymentDb.rejectedAt,
      processedAt: approvedPaymentDb.processedAt,
      internalNotes: approvedPaymentDb.internalNotes,
      orderStatus: approvedPaymentDb.order?.status ?? null,
      orderNumber: approvedPaymentDb.order?.orderNumber ?? null,
      reviewerUser: approvedPaymentDb.auditLogs[0]?.actorUser?.email ?? null,
      latestAuditAction: approvedPaymentDb.auditLogs[0]?.action ?? null,
      latestAuditToStatus: approvedPaymentDb.auditLogs[0]?.toStatus ?? null,
      transitionHistory: approvedPaymentDb.auditLogs.map((log) => ({
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        notes: log.notes,
        actorUser: log.actorUser?.email ?? null,
        createdAt: log.createdAt,
      })),
    };

    await adminPage.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
    await adminPage.getByPlaceholder("Search orders...").fill(approvedPaymentDb.order.orderNumber);
    await adminPage.getByRole("button", { name: "View" }).first().click();
    await adminPage.getByText(`FX 1 ${approvedPaymentDb.order.currency}`).waitFor({ timeout: 15000 });
    evidence.artifacts.adminOrderDetailApproved = await screenshot(adminPage, "admin-order-detail-approved");

    await customerPage.goto(`${BASE_URL}/products/${secondaryProduct.slug}`, { waitUntil: "networkidle" });
    await customerPage.getByRole("button", { name: "ADD TO BAG" }).click();
    await customerPage.waitForTimeout(1000);

    await customerPage.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();
    await customerPage.getByRole("button", { name: "Next" }).click();
    const secondOrderResponsePromise = customerPage.waitForResponse(
      (response) =>
        response.url().includes("/checkout/orders") &&
        response.request().method() === "POST",
    );
    await customerPage.getByRole("button", { name: "Place Order", exact: true }).click();
    const secondOrder = await waitForJsonResponse(secondOrderResponsePromise, "Second order create");
    evidence.rejectedFlow = {
      order: secondOrder,
    };
    await customerPage.goto(`${BASE_URL}/dashboard/payments`, { waitUntil: "networkidle" });
    await customerPage.waitForLoadState("networkidle");

    const rejectedPaymentCard = customerPage
      .locator("div.rounded-xl.border.border-border.p-5")
      .filter({ hasText: secondOrder.orderNumber })
      .first();
    await rejectedPaymentCard.waitFor({ timeout: 20000 });
    await rejectedPaymentCard.locator("input").first().fill(customerReferenceRejected);
    await rejectedPaymentCard.locator("textarea").fill("Sprint 8 rejected receipt");
    await rejectedPaymentCard.locator("input[type='file']").setInputFiles(pdfPath);
    const rejectedUploadResponsePromise = customerPage.waitForResponse(
      (response) =>
        response.url().includes("/payments/") &&
        response.url().includes("/receipt") &&
        response.request().method() === "POST",
    );
    await rejectedPaymentCard.getByRole("button", { name: "Upload Receipt" }).click();
    await waitForJsonResponse(rejectedUploadResponsePromise, "Rejected receipt upload");
    await customerPage.getByText(customerReferenceRejected).waitFor({ timeout: 20000 });
    await customerPage.getByText("PAYMENT PENDING REVIEW").first().waitFor({ timeout: 20000 });
    evidence.artifacts.customerPaymentPendingReviewPdf = await screenshot(customerPage, "customer-payment-pending-review-pdf");

    const paymentsAfterRejectedUploadResponse = await apiRequest(customerPage, "/payments");
    const paymentsAfterRejectedUpload = expectOk(
      paymentsAfterRejectedUploadResponse,
      "Customer payments after rejected receipt upload",
    ).items;
    const rejectedCandidate = paymentsAfterRejectedUpload.find(
      (payment) => payment.paymentReference === customerReferenceRejected,
    );
    assert(rejectedCandidate, "Rejected candidate payment was not created.");
    evidence.rejectedFlow = {
      ...evidence.rejectedFlow,
      initialPayment: rejectedCandidate,
    };

    await adminPage.goto(`${BASE_URL}/admin/payments/review`, { waitUntil: "networkidle" });
    const rejectedReviewCard = adminPage.locator("div.rounded-xl.border").filter({ hasText: customerReferenceRejected }).first();
    await rejectedReviewCard.waitFor({ timeout: 20000 });
    await rejectedReviewCard.locator("textarea").fill("Rejected during Sprint 8 verification");
    const rejectedReviewResponsePromise = adminPage.waitForResponse(
      (response) =>
        response.url().includes(`/admin/payments/${rejectedCandidate.id}/review`) &&
        response.request().method() === "PATCH",
    );
    await rejectedReviewCard.getByRole("button", { name: "Reject Payment" }).click();
    const rejectedReviewResult = await waitForJsonResponse(
      rejectedReviewResponsePromise,
      "Reject payment review",
    );
    evidence.rejectedFlow.reviewResponse = rejectedReviewResult;

    await adminPage.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
    await adminPage.getByText(secondOrder.orderNumber).waitFor({ timeout: 15000 });
    await adminPage.getByText("Payment Rejected").first().waitFor({ timeout: 15000 });
    evidence.artifacts.adminPaymentsRejected = await screenshot(adminPage, "admin-payments-rejected");

    await customerPage.reload({ waitUntil: "networkidle" });
    await customerPage.getByText("PAYMENT REJECTED").waitFor({ timeout: 20000 });
    evidence.artifacts.customerPaymentRejected = await screenshot(customerPage, "customer-payment-rejected");

    const rejectedPaymentDb = await prisma.payment.findFirst({
      where: {
        paymentReference: customerReferenceRejected,
      },
      include: {
        order: true,
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: { actorUser: true },
        },
      },
    });
    assert(rejectedPaymentDb, "Rejected payment not found in database.");

    const rejectedReceiptResponse = await fetch(rejectedPaymentDb.receiptUrl);
    const rejectedReceiptBuffer = await rejectedReceiptResponse.arrayBuffer();
    evidence.rejectedFlow = {
      ...evidence.rejectedFlow,
      finalPayment: {
        id: rejectedPaymentDb.id,
        status: rejectedPaymentDb.status,
        approvedAt: rejectedPaymentDb.approvedAt,
        rejectedAt: rejectedPaymentDb.rejectedAt,
        processedAt: rejectedPaymentDb.processedAt,
        internalNotes: rejectedPaymentDb.internalNotes,
        orderStatus: rejectedPaymentDb.order?.status ?? null,
        orderNumber: rejectedPaymentDb.order?.orderNumber ?? null,
        reviewerUser: rejectedPaymentDb.auditLogs[0]?.actorUser?.email ?? null,
        latestAuditAction: rejectedPaymentDb.auditLogs[0]?.action ?? null,
        latestAuditToStatus: rejectedPaymentDb.auditLogs[0]?.toStatus ?? null,
      },
      receiptDownload: {
        url: rejectedPaymentDb.receiptUrl,
        status: rejectedReceiptResponse.status,
        contentType: rejectedReceiptResponse.headers.get("content-type"),
        sizeBytes: rejectedReceiptBuffer.byteLength,
      },
    };

    await fs.writeFile(
      path.join(ARTIFACT_DIR, "verification-summary.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );

    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await Promise.allSettled([
      adminContext.close(),
      customerContext.close(),
      browser.close(),
      prisma.$disconnect(),
    ]);
  }
}

main().catch(async (error) => {
  // #region debug-point A:main-error
  await reportDebugEvent({
    hypothesisId: "A",
    message: "[DEBUG] Sprint 8 verification main error",
    data: {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { value: String(error) },
    },
  });
  // #endregion debug-point A:main-error
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
