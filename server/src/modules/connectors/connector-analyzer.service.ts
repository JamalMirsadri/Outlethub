import { createHash } from "node:crypto";

import { load } from "cheerio";
import { chromium } from "playwright";

import { ApiError } from "../../utils/api-error.js";
import { importNormalizer } from "../imports/import-normalizer.js";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_SAMPLE_PRODUCTS = 10;
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_CATEGORY = "General";
const LISTING_KEYWORDS = [
  "product",
  "products",
  "shop",
  "sale",
  "new",
  "women",
  "woman",
  "men",
  "man",
  "kids",
  "catalog",
  "clothing",
  "shoes",
  "bags",
];
const CARD_SELECTOR_BASE_CANDIDATES = [
  "[data-testid*='product']",
  "[data-testid*='Product']",
  "[data-qa*='product']",
  "[data-autoid*='product']",
  "[class*='product-card']",
  "[class*='productCard']",
  "[class*='product-item']",
  "[class*='productItem']",
  "[class*='product-tile']",
  "[class*='productTile']",
  "[class*='product-grid'] article",
  "[class*='products-grid'] article",
  "article",
  "li",
];

type FieldName = "productNameSelector" | "productPriceSelector" | "productOldPriceSelector" | "productImageSelector" | "productUrlSelector";

type AnalyzedFieldSelectors = {
  productCardSelector: string | null;
  productNameSelector: string | null;
  productPriceSelector: string | null;
  productOldPriceSelector: string | null;
  productImageSelector: string | null;
  productUrlSelector: string | null;
  paginationSelector: string | null;
  nextPageSelector: string | null;
};

export interface ConnectorAnalyzerPreviewProduct {
  name: string;
  brand: string;
  category: string;
  price: number;
  oldPrice: number | null;
  discountPercent: number;
  imageUrl: string | null;
  sourceStore: string;
  sourceUrl: string | null;
  sourceProductId: string | null;
  description: string | null;
  currency: string;
  contentHash: string;
}

export interface ConnectorAnalysisResult {
  websiteReachable: boolean;
  analyzedUrl: string;
  analyzedUrls: string[];
  selectors: AnalyzedFieldSelectors;
  parsedFields: string[];
  productsFound: number;
  sampleProducts: ConnectorAnalyzerPreviewProduct[];
}

type PageSnapshot = {
  url: string;
  html: string;
  title: string;
  internalLinks: string[];
};

function hashValue(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function escapeSelectorToken(value: string) {
  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function toAbsoluteUrl(baseUrl: string, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function isPriceLike(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /(\$|EUR|USD|GBP|€|£|\d+[.,]\d{2})/i.test(value);
}

function toPriceNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = Number(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function toBrandLabel(input: { brandName?: string | null; websiteUrl: string }) {
  if (input.brandName?.trim()) {
    return input.brandName.trim();
  }

  try {
    const hostname = new URL(input.websiteUrl).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]?.replace(/[-_]/g, " ") || "Dynamic Brand";
  } catch {
    return "Dynamic Brand";
  }
}

function buildCandidateListingUrls($: ReturnType<typeof load>, pageUrl: string) {
  const results = new Set<string>([pageUrl]);
  const origin = new URL(pageUrl).origin;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const text = $(element).text().trim().toLowerCase();
    const aria = ($(element).attr("aria-label") ?? "").toLowerCase();
    const linkValue = `${href ?? ""} ${text} ${aria}`.toLowerCase();

    if (!LISTING_KEYWORDS.some((keyword) => linkValue.includes(keyword))) {
      return;
    }

    try {
      const absolute = new URL(href ?? "", pageUrl).toString();
      if (!absolute.startsWith(origin)) {
        return;
      }

      results.add(absolute);
    } catch {
      return;
    }
  });

  return Array.from(results).slice(0, 8);
}

function buildDynamicCardCandidates($: ReturnType<typeof load>) {
  const selectors = new Set<string>(CARD_SELECTOR_BASE_CANDIDATES);

  $("[class]").each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    if (!tagName || !["article", "div", "li", "section", "a"].includes(tagName)) {
      return;
    }

    const className = $(element).attr("class") ?? "";
    className
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => /product|card|item|tile/i.test(token))
      .slice(0, 3)
      .forEach((token) => {
        selectors.add(`${tagName}.${escapeSelectorToken(token)}`);
        selectors.add(`.${escapeSelectorToken(token)}`);
      });
  });

  ["data-testid", "data-qa", "data-autoid"].forEach((attribute) => {
    $(`[${attribute}]`).each((_, element) => {
      const tagName = ($(element).get(0) as { tagName?: string } | undefined)?.tagName?.toLowerCase();
      const attributeValue = $(element).attr(attribute);
      if (!tagName || !attributeValue || !/product|card|item|tile/i.test(attributeValue)) {
        return;
      }

      selectors.add(`[${attribute}="${attributeValue}"]`);
      selectors.add(`${tagName}[${attribute}="${attributeValue}"]`);
    });
  });

  return Array.from(selectors);
}

function scoreCardSet($: ReturnType<typeof load>, selector: string) {
  const cards = $(selector).toArray();
  if (cards.length < 3 || cards.length > 200) {
    return { score: -1, count: cards.length };
  }

  const sample = cards.slice(0, 12);
  let score = 0;

  for (const element of sample) {
    const card = $(element);
    const text = card.text().replace(/\s+/g, " ").trim();
    const hasImage = card.find("img").length > 0;
    const hasLink = card.find("a[href]").length > 0;
    const hasPrice = isPriceLike(text);
    const lengthScore = Math.min(text.length, 120) / 20;

    score += hasImage ? 3 : 0;
    score += hasLink ? 3 : 0;
    score += hasPrice ? 5 : 0;
    score += lengthScore;
  }

  if (/product|card|item|tile/i.test(selector)) {
    score += 12;
  }

  if (/data-testid|data-qa|data-autoid/i.test(selector)) {
    score += 10;
  }

  if (/product-card|productitem|product-item|producttile|product-tile/i.test(selector)) {
    score += 10;
  }

  return { score, count: cards.length };
}

function nodeSelector($node: any) {
  const dataTestId = $node.attr("data-testid");
  if (dataTestId) {
    return `[data-testid="${dataTestId}"]`;
  }

  const dataQa = $node.attr("data-qa");
  if (dataQa) {
    return `[data-qa="${dataQa}"]`;
  }

  const dataAutoId = $node.attr("data-autoid");
  if (dataAutoId) {
    return `[data-autoid="${dataAutoId}"]`;
  }

  const id = $node.attr("id");
  if (id) {
    return `#${escapeSelectorToken(id)}`;
  }

  const className = $node.attr("class") ?? "";
  const classTokens = className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token: string) => /[a-z]/i.test(token))
    .filter((token: string) => token.length > 2)
    .slice(0, 2);

  if (classTokens.length > 0) {
    return classTokens.map((token: string) => `.${escapeSelectorToken(token)}`).join("");
  }

  return $node.get(0)?.tagName?.toLowerCase() ?? null;
}

function collectFieldCandidates($: ReturnType<typeof load>, cards: any[]) {
  const candidates = new Set<string>();
  const seedSelectors = [
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "a[href]",
    "img",
    "span",
    "[class*='name']",
    "[class*='title']",
    "[class*='price']",
    "[class*='old']",
    "[class*='image']",
    "[data-testid*='name']",
    "[data-testid*='title']",
    "[data-testid*='price']",
    "[data-testid*='image']",
  ];

  seedSelectors.forEach((selector) => candidates.add(selector));

  for (const cardElement of cards.slice(0, 5)) {
    const descendants = $(cardElement).find("*").slice(0, 40).toArray();
    for (const descendant of descendants) {
      const selector = nodeSelector($(descendant));
      if (selector) {
        candidates.add(selector);
      }
    }
  }

  return Array.from(candidates);
}

function scoreFieldSelector(
  $: ReturnType<typeof load>,
  cards: any[],
  selector: string,
  fieldName: FieldName,
) {
  let score = 0;
  let matchedCards = 0;

  for (const cardElement of cards.slice(0, 10)) {
    const node = $(cardElement).find(selector).first();
    if (!node.length) {
      continue;
    }

    const text = node.text().replace(/\s+/g, " ").trim();
    const src = node.attr("src") ?? node.attr("data-src") ?? node.attr("data-lazy-src") ?? null;
    const href = node.attr("href") ?? node.attr("data-href") ?? null;

    if (fieldName === "productNameSelector") {
      if (text.length >= 4 && text.length <= 160 && !isPriceLike(text)) {
        matchedCards += 1;
        score += 6;
      }

      if (/name|title|headline/i.test(selector)) {
        score += 4;
      }
    }

    if (fieldName === "productPriceSelector") {
      if (isPriceLike(text)) {
        matchedCards += 1;
        score += 7;
      }

      if (/price|sale|current|final/i.test(selector)) {
        score += 4;
      }
    }

    if (fieldName === "productOldPriceSelector") {
      if (isPriceLike(text)) {
        matchedCards += 1;
        score += 5;
      }

      if (/old|compare|was|original|strike/i.test(selector)) {
        score += 5;
      }
    }

    if (fieldName === "productImageSelector") {
      if (src) {
        matchedCards += 1;
        score += 8;
      }
    }

    if (fieldName === "productUrlSelector") {
      if (href && href !== "#") {
        matchedCards += 1;
        score += 8;
      }
    }

    if (/data-testid|data-qa|data-autoid/i.test(selector)) {
      score += 5;
    }
  }

  return { score, matchedCards };
}

function detectFieldSelectors($: ReturnType<typeof load>, cardSelector: string) {
  const cards = $(cardSelector).toArray();
  const candidates = collectFieldCandidates($, cards);
  const fields: FieldName[] = [
    "productNameSelector",
    "productPriceSelector",
    "productOldPriceSelector",
    "productImageSelector",
    "productUrlSelector",
  ];

  return fields.reduce<Record<FieldName, string | null>>((result, fieldName) => {
    let bestSelector: string | null = null;
    let bestScore = -1;

    for (const selector of candidates) {
      const { score, matchedCards } = scoreFieldSelector($, cards, selector, fieldName);
      if (matchedCards < Math.max(2, Math.floor(Math.min(cards.length, 10) * 0.3))) {
        continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSelector = selector;
      }
    }

    result[fieldName] = bestSelector;
    return result;
  }, {
    productNameSelector: null,
    productPriceSelector: null,
    productOldPriceSelector: null,
    productImageSelector: null,
    productUrlSelector: null,
  });
}

function detectPaginationSelectors($: ReturnType<typeof load>) {
  const paginationCandidates = [
    "nav[aria-label*='pagination'] a",
    "[class*='pagination'] a",
    "[data-testid*='pagination'] a",
  ];
  const nextCandidates = [
    "a[rel='next']",
    "a[aria-label*='Next']",
    "a[aria-label*='next']",
    "[class*='next']",
  ];

  return {
    paginationSelector: paginationCandidates.find((selector) => $(selector).length > 1) ?? null,
    nextPageSelector: nextCandidates.find((selector) => $(selector).length > 0) ?? null,
  };
}

function buildPreviewProducts(input: {
  $: ReturnType<typeof load>;
  pageUrl: string;
  selectors: AnalyzedFieldSelectors;
  brandName: string;
  currencyCode: string;
}) {
  const { $, pageUrl, selectors, brandName, currencyCode } = input;
  if (!selectors.productCardSelector) {
    return [];
  }

  const rawRecords = $(selectors.productCardSelector)
    .slice(0, MAX_SAMPLE_PRODUCTS)
    .toArray()
    .map((element, index) => {
      const card = $(element);
      const title = selectors.productNameSelector ? card.find(selectors.productNameSelector).first().text().replace(/\s+/g, " ").trim() : null;
      const price = selectors.productPriceSelector ? card.find(selectors.productPriceSelector).first().text().replace(/\s+/g, " ").trim() : null;
      const oldPrice = selectors.productOldPriceSelector ? card.find(selectors.productOldPriceSelector).first().text().replace(/\s+/g, " ").trim() : null;
      const imageSelectorNode = selectors.productImageSelector ? card.find(selectors.productImageSelector).first() : null;
      const urlSelectorNode = selectors.productUrlSelector ? card.find(selectors.productUrlSelector).first() : null;
      const image = toAbsoluteUrl(
        pageUrl,
        imageSelectorNode?.attr("src") ?? imageSelectorNode?.attr("data-src") ?? imageSelectorNode?.attr("data-lazy-src") ?? null,
      );
      const link = toAbsoluteUrl(pageUrl, urlSelectorNode?.attr("href") ?? urlSelectorNode?.attr("data-href") ?? null);

      return {
        title,
        price,
        oldPrice,
        image,
        link,
        id: hashValue(`${pageUrl}:${link ?? title ?? index}`),
        brand: brandName,
        category: DEFAULT_CATEGORY,
        currency: currencyCode,
      };
    })
    .filter((record) => record.title || record.price || record.image || record.link);

  const normalizeContext = {
    configuration: {
      fieldMap: {
        name: "title",
        brand: "brand",
        category: "category",
        price: "price",
        oldPrice: "oldPrice",
        imageUrl: "image",
        sourceUrl: "link",
        sourceProductId: "id",
        currency: "currency",
      },
      defaultBrand: brandName,
      defaultCategory: DEFAULT_CATEGORY,
      sourceStore: brandName,
    },
    sourceStore: brandName,
    website: pageUrl,
  } as const;

  return rawRecords.reduce<ConnectorAnalyzerPreviewProduct[]>((result, record) => {
    try {
      result.push(importNormalizer.normalizeRecord(record, normalizeContext));
    } catch {
      return result;
    }

    return result;
  }, []);
}

async function capturePage(url: string) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT_MS);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    if (!response) {
      throw new ApiError(400, "Connector analyzer could not load the requested website.");
    }

    await page.waitForLoadState("networkidle").catch(() => undefined);
    const html = await page.content();
    if (!html.trim()) {
      throw new ApiError(400, `Connector analyzer failed with status ${response.status()}.`);
    }
    const pageUrl = page.url();
    const title = await page.title();
    const $ = load(html);

    return {
      url: pageUrl,
      html,
      title,
      internalLinks: buildCandidateListingUrls($, pageUrl),
    } satisfies PageSnapshot;
  } finally {
    await browser.close();
  }
}

function analyzeSnapshot(snapshot: PageSnapshot, options: { brandName?: string | null; currencyCode?: string | null }) {
  const $ = load(snapshot.html);
  const candidates = buildDynamicCardCandidates($);
  let bestCardSelector: string | null = null;
  let bestScore = -1;

  for (const selector of candidates) {
    const { score } = scoreCardSet($, selector);
    if (score > bestScore) {
      bestScore = score;
      bestCardSelector = selector;
    }
  }

  if (!bestCardSelector) {
    return {
      score: -1,
      result: {
        websiteReachable: true,
        analyzedUrl: snapshot.url,
        analyzedUrls: [snapshot.url],
        selectors: {
          productCardSelector: null,
          productNameSelector: null,
          productPriceSelector: null,
          productOldPriceSelector: null,
          productImageSelector: null,
          productUrlSelector: null,
          paginationSelector: null,
          nextPageSelector: null,
        },
        parsedFields: [],
        productsFound: 0,
        sampleProducts: [],
      } satisfies ConnectorAnalysisResult,
    };
  }

  const fieldSelectors = detectFieldSelectors($, bestCardSelector);
  const paginationSelectors = detectPaginationSelectors($);
  const brandName = toBrandLabel({ brandName: options.brandName, websiteUrl: snapshot.url });
  const currencyCode = options.currencyCode?.trim() || DEFAULT_CURRENCY;
  const sampleProducts = buildPreviewProducts({
    $,
    pageUrl: snapshot.url,
    selectors: {
      productCardSelector: bestCardSelector,
      ...fieldSelectors,
      ...paginationSelectors,
    },
    brandName,
    currencyCode,
  });

  return {
    score: bestScore + sampleProducts.length * 10,
    result: {
      websiteReachable: true,
      analyzedUrl: snapshot.url,
      analyzedUrls: [snapshot.url],
      selectors: {
        productCardSelector: bestCardSelector,
        ...fieldSelectors,
        ...paginationSelectors,
      },
      parsedFields: ["title", "price", "oldPrice", "image", "link", "id", "brand", "category", "currency"],
      productsFound: sampleProducts.length,
      sampleProducts,
    } satisfies ConnectorAnalysisResult,
  };
}

export class ConnectorAnalyzerService {
  public async analyzeWebsite(input: {
    websiteUrl: string;
    brandName?: string | null;
    currencyCode?: string | null;
  }): Promise<ConnectorAnalysisResult> {
    const initialSnapshot = await capturePage(input.websiteUrl);
    const snapshots = [initialSnapshot];

    for (const candidateUrl of initialSnapshot.internalLinks.slice(0, 4)) {
      if (candidateUrl === initialSnapshot.url) {
        continue;
      }

      try {
        snapshots.push(await capturePage(candidateUrl));
      } catch {
        continue;
      }
    }

    let bestAnalysis = analyzeSnapshot(initialSnapshot, input);
    const analyzedUrls = new Set<string>([initialSnapshot.url]);

    for (const snapshot of snapshots.slice(1)) {
      analyzedUrls.add(snapshot.url);
      const nextAnalysis = analyzeSnapshot(snapshot, input);
      if (nextAnalysis.score > bestAnalysis.score) {
        bestAnalysis = nextAnalysis;
      }
    }

    return {
      ...bestAnalysis.result,
      analyzedUrls: Array.from(analyzedUrls),
    };
  }
}

export const connectorAnalyzerService = new ConnectorAnalyzerService();
