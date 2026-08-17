import React, { useState, useEffect, useRef } from "react";
import { appClient, importAdminProductsCsv, listAdminProductsPage } from "@/api/appClient";
import { getProductSourceInfo, updateProductPricingOverride } from "@/api/commerce";
import {
  getGlobalProductMonitoringSettings,
  getProductMonitoringSettings,
  runProductMonitoring,
  updateGlobalProductMonitoringSettings,
  updateProductMonitoringSettings,
} from "@/api/monitoring";
import { HttpError } from "@/services/http";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, EyeOff, RefreshCw, Clock3, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";

const defaultForm = {
  title: "",
  brand: "",
  category: "",
  original_price: "",
  outlet_price: "",
  final_price: "",
  description: "",
  status: "active",
  sku: "",
  gender: "unisex",
  stock: "0",
  stock_status: "unknown",
  image_urls_text: "",
  sizes_text: "",
  colors_text: "",
  variants_text: "",
  is_featured: false,
  source_store: "",
  source_url: "",
  use_custom_pricing: false,
  custom_price: "",
};

const CUSTOM_OPTION_VALUE = "__custom__";
const ADMIN_EXPORT_PAGE_SIZE = 100;

function parseImageUrls(value) {
  if (typeof value !== "string") {
    return [];
  }

  return [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))];
}

function hasNamedOption(options, value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return options.some((option) => option?.name?.trim?.().toLowerCase() === normalizedValue);
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getErrorMessage(error) {
  if (error instanceof HttpError) {
    return error.message || "Request failed.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while saving the product.";
}

function formatDateTime(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function formatIntervalMinutes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  if (value % 1440 === 0) {
    return `${value / 1440} day${value / 1440 === 1 ? "" : "s"}`;
  }

  if (value % 60 === 0) {
    return `${value / 60} hour${value / 60 === 1 ? "" : "s"}`;
  }

  return `${value} min`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function escapeCsvValue(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function getStorefrontProductUrl(product) {
  const productPath = `/products/${product?.slug || product?.id || ""}`;
  if (typeof window === "undefined") {
    return productPath;
  }

  return new URL(productPath, window.location.origin).toString();
}

function getExportProductTitle(product) {
  return product?.title ?? product?.name ?? "";
}

function getExportProductSourceUrl(product) {
  return product?.source_url ?? product?.sourceUrl ?? "";
}

async function fetchAdminProductsForExport(brandIds = []) {
  const fetchPages = async (brandId) => {
    const allItems = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await listAdminProductsPage({
        page,
        pageSize: ADMIN_EXPORT_PAGE_SIZE,
        brandId,
        includeDeleted: false,
      });

      allItems.push(...response.items);
      totalPages = response.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);

    return allItems;
  };

  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return fetchPages(undefined);
  }

  const itemsByBrand = await Promise.all(brandIds.map((brandId) => fetchPages(brandId)));
  const uniqueItems = new Map();

  itemsByBrand.flat().forEach((item) => {
    if (!uniqueItems.has(item.id)) {
      uniqueItems.set(item.id, item);
    }
  });

  return Array.from(uniqueItems.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function getCategoryChildren(categories, parentId = null) {
  return categories
    .filter((category) => (category?.parent_id ?? null) === parentId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId) ?? null;
}

function buildCategoryPath(categories, categoryId) {
  const segments = [];
  let current = getCategoryById(categories, categoryId);

  while (current) {
    segments.unshift(current.name);
    current = current.parent_id ? getCategoryById(categories, current.parent_id) : null;
  }

  return segments.join(" / ");
}

function buildImportCategoryHierarchy(categories) {
  return getCategoryChildren(categories).map((mainCategory) => ({
    ...mainCategory,
    children: getCategoryChildren(categories, mainCategory.id),
  }));
}

function getMonitoringMeta(product) {
  const hasSourceUrl = typeof product?.source_url === "string" && product.source_url.trim().length > 0;
  const latestStatus =
    typeof product?.monitoring_status === "string"
      ? product.monitoring_status.toUpperCase()
      : null;
  const updatedAt =
    typeof product?.updated_date === "string" && !Number.isNaN(new Date(product.updated_date).getTime())
      ? new Date(product.updated_date)
      : null;
  const monitoredAt =
    typeof (product?.monitoring_checked_at ?? product?.last_synced_at) === "string" &&
    !Number.isNaN(new Date(product.monitoring_checked_at ?? product.last_synced_at).getTime())
      ? new Date(product.monitoring_checked_at ?? product.last_synced_at)
      : null;

  if (!hasSourceUrl) {
    return {
      label: "Manual",
      className: "",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: "—",
    };
  }

  if (!monitoredAt) {
    return {
      label: "Not monitored",
      className: "",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: "—",
    };
  }

  if (latestStatus === "BLOCKED") {
    return {
      label: "Blocked",
      className: "bg-destructive/10 text-destructive",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: formatDateTime(product?.monitoring_checked_at ?? product?.last_synced_at),
    };
  }

  if (latestStatus === "FAILED") {
    return {
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: formatDateTime(product?.monitoring_checked_at ?? product?.last_synced_at),
    };
  }

  if (latestStatus === "REMOVED") {
    return {
      label: "Removed",
      className: "bg-muted text-foreground",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: formatDateTime(product?.monitoring_checked_at ?? product?.last_synced_at),
    };
  }

  if (latestStatus === "NO_CHANGES") {
    return {
      label: "No changes",
      className: "",
      updatedAtLabel: formatDateTime(product?.updated_date),
      monitoredAtLabel: formatDateTime(product?.monitoring_checked_at ?? product?.last_synced_at),
    };
  }

  const wasUpdatedByMonitoring = updatedAt
    ? Math.abs(updatedAt.getTime() - monitoredAt.getTime()) <= 60 * 1000
    : false;

  return {
    label: wasUpdatedByMonitoring ? "Updated" : "No changes",
    className: wasUpdatedByMonitoring ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]" : "",
    updatedAtLabel: formatDateTime(product?.updated_date),
    monitoredAtLabel: monitoredAt.toLocaleString(),
  };
}

function createVariantItem(size = "", stockQuantity = "0") {
  return {
    id: `variant-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    size,
    stockQuantity: String(stockQuantity ?? "0"),
  };
}

function createVariantGroup(color = "", items) {
  return {
    id: `variant-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    color,
    items: Array.isArray(items) && items.length > 0 ? items : [createVariantItem()],
  };
}

function buildVariantGroupsFromProduct(product) {
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    const grouped = new Map();

    product.variants.forEach((variant) => {
      const color = typeof variant?.color === "string" ? variant.color : "";
      const key = color.toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, createVariantGroup(color, []));
      }

      grouped.get(key).items.push(
        createVariantItem(
          typeof variant?.size === "string" ? variant.size : "",
          variant?.stockQuantity ?? 0,
        ),
      );
    });

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      items: group.items.length > 0 ? group.items : [createVariantItem()],
    }));
  }

  if (Array.isArray(product?.colors) && product.colors.length > 0) {
    return product.colors.map((color) =>
      createVariantGroup(
        color,
        Array.isArray(product?.sizes) && product.sizes.length > 0
          ? product.sizes.map((size) => createVariantItem(size, 0))
          : [createVariantItem()],
      ),
    );
  }

  return [createVariantGroup()];
}

function summarizeVariantGroups(groups) {
  const variants = [];

  groups.forEach((group) => {
    const color = typeof group?.color === "string" ? group.color.trim() : "";

    (Array.isArray(group?.items) ? group.items : []).forEach((item) => {
      const size = typeof item?.size === "string" ? item.size.trim() : "";
      if (!color && !size) {
        return;
      }

      const stockQuantity = Number(item?.stockQuantity);
      variants.push({
        size: size || undefined,
        color: color || undefined,
        stockQuantity: Number.isFinite(stockQuantity) && stockQuantity >= 0 ? stockQuantity : 0,
      });
    });
  });

  const uniqueSizes = [...new Set(variants.map((variant) => variant.size).filter(Boolean))];
  const uniqueColors = [...new Set(variants.map((variant) => variant.color).filter(Boolean))];

  return {
    variants,
    sizesText: uniqueSizes.join(", "),
    colorsText: uniqueColors.join(", "),
    variantsText: variants
      .map((variant) => [variant.size || "", variant.color || "", variant.stockQuantity].join(" | "))
      .join("\n"),
    totalStock: variants.reduce((sum, variant) => sum + (variant.stockQuantity ?? 0), 0),
  };
}

function validateVariantGroups(groups) {
  const seen = new Set();

  for (const group of groups) {
    const color = typeof group?.color === "string" ? group.color.trim() : "";
    const items = Array.isArray(group?.items) ? group.items : [];
    for (const item of items) {
      const size = typeof item?.size === "string" ? item.size.trim() : "";
      const stockValue = typeof item?.stockQuantity === "string" ? item.stockQuantity.trim() : String(item?.stockQuantity ?? "");

      if (!color && !size && !stockValue) {
        continue;
      }

      const stockQuantity = Number(item?.stockQuantity);

      if (stockValue && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) {
        return `Stock for ${color || "this variant"}${size ? ` / ${size}` : ""} must be a valid number.`;
      }

      if (color && size) {
        const key = `${color.toLowerCase()}::${size.toLowerCase()}`;
        if (seen.has(key)) {
          return `Duplicate variant found for ${color} / ${size}.`;
        }

        seen.add(key);
      }
    }
  }

  return null;
}

export default function AdminProducts() {
  const importFileInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [globalMonitoringDialogOpen, setGlobalMonitoringDialogOpen] = useState(false);
  const [globalMonitoringSettings, setGlobalMonitoringSettings] = useState(null);
  const [globalMonitoringLoading, setGlobalMonitoringLoading] = useState(true);
  const [globalMonitoringSaving, setGlobalMonitoringSaving] = useState(false);
  const [globalMonitoringForm, setGlobalMonitoringForm] = useState({
    enabled: true,
    intervalMinutes: "360",
  });
  const [productMonitoringSaving, setProductMonitoringSaving] = useState(false);
  const [productMonitoringForm, setProductMonitoringForm] = useState({
    useGlobalInterval: true,
    intervalMinutes: "",
  });
  const [manualUpdatingIds, setManualUpdatingIds] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sourceInfo, setSourceInfo] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandInputMode, setBrandInputMode] = useState(false);
  const [categoryInputMode, setCategoryInputMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variantGroups, setVariantGroups] = useState([createVariantGroup()]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportAllBrands, setExportAllBrands] = useState(true);
  const [selectedExportBrandIds, setSelectedExportBrandIds] = useState([]);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [previewingCsv, setPreviewingCsv] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importSelection, setImportSelection] = useState({
    brandId: "",
    mainCategoryId: "",
    subcategoryId: "",
  });
  const [importPreview, setImportPreview] = useState(null);
  const [importResultDialogOpen, setImportResultDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadProducts = async () => {
    try {
      const items = await appClient.entities.Product.list("-created_date", 50);
      setProducts(items);
    } catch {
      toast({
        title: "Unable to load products",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  const loadGlobalSettings = async () => {
    setGlobalMonitoringLoading(true);
    try {
      const settings = await getGlobalProductMonitoringSettings();
      setGlobalMonitoringSettings(settings);
      setGlobalMonitoringForm({
        enabled: Boolean(settings.enabled),
        intervalMinutes: String(settings.intervalMinutes ?? 360),
      });
      return settings;
    } catch {
      toast({
        title: "Unable to load monitoring settings",
        description: "Try again in a moment.",
        variant: "destructive",
      });
      return null;
    } finally {
      setGlobalMonitoringLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalSettings();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [brandItems, categoryItems] = await Promise.all([
        appClient.entities.Brand.list("-created_date", 200),
        appClient.entities.Category.list("-created_date", 200),
      ]);
      setBrands(brandItems);
      setCategories(categoryItems);
    } catch {
      toast({
        title: "Unable to load brands and categories",
        description: "You can still type them manually and try again.",
        variant: "destructive",
      });
    } finally {
      setReferenceLoading(false);
    }
  };

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    if (!dialogOpen || !editing || !sourceInfo?.monitoring || !globalMonitoringSettings) {
      return;
    }

    const resolvedInterval = sourceInfo.monitoring.intervalMinutes;
    const useGlobalInterval = resolvedInterval === globalMonitoringSettings.intervalMinutes;

    setProductMonitoringForm({
      useGlobalInterval,
      intervalMinutes: useGlobalInterval ? String(globalMonitoringSettings.intervalMinutes) : String(resolvedInterval),
    });
  }, [dialogOpen, editing, sourceInfo, globalMonitoringSettings]);

  const filtered = products.filter(p => {
    if (search && !p.title?.toLowerCase().includes(search.toLowerCase()) && !p.brand?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });
  const mainImportCategories = getCategoryChildren(categories);
  const importSubcategories = importSelection.mainCategoryId
    ? getCategoryChildren(categories, importSelection.mainCategoryId)
    : [];
  const importCategoryHierarchy = buildImportCategoryHierarchy(categories);
  const selectedImportBrand = brands.find((brand) => brand.id === importSelection.brandId) ?? null;
  const selectedMainImportCategory = getCategoryById(categories, importSelection.mainCategoryId);
  const selectedDestinationCategory = getCategoryById(
    categories,
    importSelection.subcategoryId || importSelection.mainCategoryId,
  );
  const importDestinationLabel = selectedDestinationCategory
    ? buildCategoryPath(categories, selectedDestinationCategory.id)
    : "";
  const canPreviewImport =
    Boolean(importFile) && Boolean(importSelection.brandId) && Boolean(importSelection.mainCategoryId);

  const exportProductsMapping = async () => {
    if (!exportAllBrands && selectedExportBrandIds.length === 0) {
      toast({
        title: "Select at least one brand",
        description: "Choose one or more brands, or switch back to All Brands.",
        variant: "destructive",
      });
      return;
    }

    setExportingCsv(true);

    try {
      const exportProducts = await fetchAdminProductsForExport(
        exportAllBrands ? [] : selectedExportBrandIds,
      );
      const selectedBrandNames = brands
        .filter((brand) => selectedExportBrandIds.includes(brand.id))
        .map((brand) => brand.name);

    const header = ["Product name", "Source URL", "My site"];
      const rows = exportProducts.map((product) => [
      getExportProductTitle(product),
      getExportProductSourceUrl(product),
      getStorefrontProductUrl(product),
    ]);
      const csvContent = [header, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\r\n");
      const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = "Mapping.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast({
        title: "CSV exported",
        description: exportAllBrands
          ? `${exportProducts.length} products exported for all brands.`
          : `${exportProducts.length} products exported for ${selectedBrandNames.join(", ")}.`,
      });
      setExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Failed to export CSV",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleChooseImportFile = () => {
    importFileInputRef.current?.click();
  };

  const resetImportDialog = () => {
    setImportFile(null);
    setImportSelection({
      brandId: "",
      mainCategoryId: "",
      subcategoryId: "",
    });
    setImportPreview(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportFile(file);
    setImportPreview(null);
  };

  const handleOpenImportDialog = () => {
    resetImportDialog();
    setImportDialogOpen(true);
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      toast({
        title: "Choose a CSV file",
        description: "Upload the CSV file before validating the import.",
        variant: "destructive",
      });
      return;
    }

    if (!importSelection.brandId) {
      toast({
        title: "Select a brand/site",
        description: "Choose which brand/site should be replaced by this import.",
        variant: "destructive",
      });
      return;
    }

    if (!importSelection.mainCategoryId) {
      toast({
        title: "Select a destination category",
        description: "Choose the main category before validating the import.",
        variant: "destructive",
      });
      return;
    }

    setPreviewingCsv(true);

    try {
      const content = await importFile.text();
      const preview = await importAdminProductsCsv({
        mode: "PREVIEW",
        content,
        fileName: importFile.name,
        brandId: importSelection.brandId,
        mainCategoryId: importSelection.mainCategoryId,
        subcategoryId: importSelection.subcategoryId || null,
      });

      setImportPreview(preview);

      if (!preview.readyToImport) {
        toast({
          title: "CSV validation failed",
          description: "Nothing was deleted. Review the row-level issues before continuing.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "CSV validated",
        description: preview.confirmationMessage ?? "The CSV is ready to import.",
      });
    } catch (error) {
      toast({
        title: "Failed to validate CSV",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPreviewingCsv(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile || !importPreview?.readyToImport) {
      return;
    }

    setImportingCsv(true);

    try {
      const content = await importFile.text();
      const result = await importAdminProductsCsv({
        mode: "IMPORT",
        content,
        fileName: importFile.name,
        brandId: importSelection.brandId,
        mainCategoryId: importSelection.mainCategoryId,
        subcategoryId: importSelection.subcategoryId || null,
      });

      setImportResult(result);
      setImportResultDialogOpen(true);
      setImportDialogOpen(false);
      resetImportDialog();
      await Promise.all([loadProducts(), loadReferenceData()]);

      toast({
        title: "CSV import finished",
        description: `${result.summary.deleted} deleted, ${result.summary.imported} imported, ${result.summary.skipped} skipped, ${result.summary.failed} failed.`,
      });
    } catch (error) {
      toast({
        title: "Failed to import CSV",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setImportingCsv(false);
    }
  };

  const openEdit = async (p) => {
    setEditing(p);
    setBrandInputMode(!hasNamedOption(brands, p.brand));
    setCategoryInputMode(!hasNamedOption(categories, p.category));
    setForm({
      title: p.title||"",
      brand: p.brand||"",
      category: p.category||"",
      original_price: p.original_price||"",
      outlet_price: p.outlet_price||"",
      final_price: p.final_price||"",
      description: p.description||"",
      status: p.status||"active",
      sku: p.sku||"",
      gender: p.gender||"unisex",
      stock: p.stock || "0",
      stock_status: p.stock_status || "unknown",
      image_urls_text: p.images?.join("\n") || "",
      sizes_text: p.sizes?.join(", ") || "",
      colors_text: p.colors?.join(", ") || "",
      variants_text: p.variants?.map(v => [v.size||"", v.color||"", v.stockQuantity||0].join(" | ")).join("\n") || "",
      is_featured: p.is_featured || false,
      source_store: p.source_store || "",
      source_url: p.source_url || "",
      use_custom_pricing: p.useCustomPricing || false,
      custom_price: p.customPrice ?? "",
    });
    setVariantGroups(buildVariantGroupsFromProduct(p));
    try {
      const [productSourceInfo, settings] = await Promise.all([
        getProductSourceInfo(p.id),
        globalMonitoringSettings ? Promise.resolve(globalMonitoringSettings) : loadGlobalSettings(),
      ]);
      setSourceInfo(productSourceInfo);
      if (productSourceInfo?.monitoring && settings) {
        const useGlobalInterval = productSourceInfo.monitoring.intervalMinutes === settings.intervalMinutes;
        setProductMonitoringForm({
          useGlobalInterval,
          intervalMinutes: useGlobalInterval
            ? String(settings.intervalMinutes)
            : String(productSourceInfo.monitoring.intervalMinutes),
        });
      }
    } catch {
      setSourceInfo(null);
    }
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setVariantGroups([createVariantGroup()]);
    setSourceInfo(null);
    setBrandInputMode(false);
    setCategoryInputMode(false);
    setDialogOpen(true);
  };

  const save = async () => {
    const variantError = validateVariantGroups(variantGroups);
    if (variantError) {
      toast({ title: variantError, variant: "destructive" });
      return;
    }

    const variantSummary = summarizeVariantGroups(variantGroups);
    const title = form.title.trim();
    const brand = form.brand.trim();
    const category = form.category.trim();
    const sku = form.sku.trim();
    const sourceUrl = form.source_url.trim();
    const originalPrice = Number(form.original_price);
    const outletPrice = form.outlet_price === "" ? originalPrice : Number(form.outlet_price);
    const finalPrice = Number(form.final_price);
    const stock = variantSummary.variants.length > 0 ? variantSummary.totalStock : Number(form.stock);
    const customPrice = form.custom_price === "" ? null : Number(form.custom_price);

    if (!title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    if (!brand) {
      toast({ title: "Brand is required", variant: "destructive" });
      return;
    }

    if (!category) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }

    if (sku && sku.length < 2) {
      toast({ title: "SKU must be at least 2 characters", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      toast({ title: "Original price must be a valid number", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(outletPrice) || outletPrice < 0) {
      toast({ title: "Outlet price must be a valid number", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      toast({ title: "Final price must be a valid number", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      toast({ title: "Stock must be a valid number", variant: "destructive" });
      return;
    }

    if (!isValidUrl(sourceUrl)) {
      toast({ title: "Source URL must be a valid URL", variant: "destructive" });
      return;
    }

    if (form.use_custom_pricing && (customPrice === null || !Number.isFinite(customPrice) || customPrice < 0)) {
      toast({ title: "Custom price must be a valid number", variant: "destructive" });
      return;
    }

    const data = {
      ...form,
      title,
      brand,
      category,
      sku,
      source_url: sourceUrl,
      original_price: originalPrice,
      outlet_price: outletPrice,
      final_price: finalPrice,
      stock,
      sizes_text: variantSummary.sizesText,
      colors_text: variantSummary.colorsText,
      variants_text: variantSummary.variantsText,
      variants: variantSummary.variants,
      discount_percent: originalPrice > 0 && finalPrice < originalPrice
        ? Math.round((1 - finalPrice / originalPrice) * 100)
        : 0,
    };

    delete data.use_custom_pricing;
    delete data.custom_price;

    setSaving(true);
    try {
      if (editing) {
        const updated = await appClient.entities.Product.update(editing.id, data);
        await updateProductPricingOverride(editing.id, {
          useCustomPricing: Boolean(form.use_custom_pricing),
          customPrice,
        });
        try {
          setSourceInfo(await getProductSourceInfo(editing.id));
        } catch {
          setSourceInfo(null);
        }
        setProducts((currentProducts) => currentProducts.map((p) => p.id === editing.id ? updated : p));
        toast({ title: "Product updated" });
      } else {
        const created = await appClient.entities.Product.create(data);
        setProducts((currentProducts) => [created, ...currentProducts]);
        toast({ title: "Product created" });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: editing ? "Failed to update product" : "Failed to create product",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const imagePreviews = parseImageUrls(form.image_urls_text);
  const variantSummary = summarizeVariantGroups(variantGroups);
  const hasVariantAvailability = variantSummary.variants.length > 0;
  const brandSelectValue = !brandInputMode && hasNamedOption(brands, form.brand) ? form.brand : CUSTOM_OPTION_VALUE;
  const categorySelectValue = !categoryInputMode && hasNamedOption(categories, form.category) ? form.category : CUSTOM_OPTION_VALUE;

  const deleteProduct = async (id) => {
    await appClient.entities.Product.delete(id);
    setProducts(products.filter(p => p.id !== id));
  };

  const toggleVisibility = async (p) => {
    const newStatus = p.status === "active" ? "draft" : "active";
    await appClient.entities.Product.update(p.id, { status: newStatus });
    setProducts(products.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
  };

  const handleManualUpdate = async (product) => {
    if (!product?.source_url) {
      toast({
        title: "Missing source URL",
        description: "This product cannot be monitored manually without a source URL.",
        variant: "destructive",
      });
      return;
    }

    setManualUpdatingIds((current) => ({ ...current, [product.id]: true }));
    try {
      // #region debug-point A:manual-update-click
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "manual-update-stuck",
          runId: "pre-fix",
          hypothesisId: "A",
          location: "AdminProducts.jsx:handleManualUpdate:before",
          msg: "[DEBUG] manual update clicked",
          data: {
            productId: product.id,
            sourceUrl: product.source_url,
            finalPrice: product.final_price,
            outletPrice: product.outlet_price,
            updatedDate: product.updated_date,
            lastSyncedAt: product.last_synced_at ?? null,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      await runProductMonitoring(product.id, "manual");
      const previousCheckedAt =
        typeof (product.monitoring_checked_at ?? product.last_synced_at) === "string"
          ? product.monitoring_checked_at ?? product.last_synced_at
          : null;

      let overview = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await wait(2000);
        overview = await getProductMonitoringSettings(product.id).catch(() => null);
        const currentCheckedAt = overview?.latestLog?.lastCheckedAt ?? overview?.lastCheckedAt ?? null;
        if (currentCheckedAt && currentCheckedAt !== previousCheckedAt) {
          break;
        }
        overview = null;
      }

      const refreshedProduct = await appClient.entities.Product.get(product.id).catch(() => product);
      const latestStatus = overview?.latestLog?.status ?? null;
      const latestCheckedAt = overview?.latestLog?.lastCheckedAt ?? overview?.lastCheckedAt ?? null;

      setProducts((current) =>
        current.map((entry) =>
          entry.id === product.id
            ? {
                ...refreshedProduct,
                monitoring_status: latestStatus,
                monitoring_checked_at: latestCheckedAt,
              }
            : entry,
        ),
      );

      if (editing?.id === product.id) {
        try {
          setSourceInfo(await getProductSourceInfo(product.id));
        } catch {
          setSourceInfo(null);
        }
      }

      // #region debug-point D:manual-update-result-surfaced
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "manual-update-stuck",
          runId: "post-fix",
          hypothesisId: "D",
          location: "AdminProducts.jsx:handleManualUpdate:result",
          msg: "[DEBUG] manual update result surfaced to admin ui",
          data: {
            productId: product.id,
            latestStatus,
            latestCheckedAt,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      if (!overview?.latestLog) {
        toast({
          title: "Manual update queued",
          description: "The check was queued, but the latest result is not available yet. Try again in a few seconds.",
        });
        return;
      }

      if (latestStatus === "UPDATED") {
        toast({
          title: "Product updated from source",
          description: `Checked at ${formatDateTime(latestCheckedAt)}.`,
        });
        return;
      }

      if (latestStatus === "NO_CHANGES") {
        toast({
          title: "No source changes found",
          description: `Checked at ${formatDateTime(latestCheckedAt)}.`,
        });
        return;
      }

      if (latestStatus === "BLOCKED") {
        toast({
          title: "Source blocked the update",
          description: overview.latestLog.errorMessage || "The source website returned a blocked/CAPTCHA response.",
          variant: "destructive",
        });
        return;
      }

      if (latestStatus === "FAILED") {
        toast({
          title: "Manual update failed",
          description: overview.latestLog.errorMessage || "The monitoring job failed.",
          variant: "destructive",
        });
        return;
      }

      if (latestStatus === "REMOVED") {
        toast({
          title: "Product removed from source",
          description: "The source product is no longer available.",
        });
        return;
      }

      toast({
        title: "Manual update queued",
        description: "The product monitoring job has been added to the queue.",
      });
    } catch (error) {
      toast({
        title: "Failed to queue manual update",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setManualUpdatingIds((current) => ({ ...current, [product.id]: false }));
    }
  };

  const handleSaveGlobalMonitoring = async () => {
    const intervalMinutes = Number(globalMonitoringForm.intervalMinutes);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5) {
      toast({
        title: "Monitoring time must be at least 5 minutes",
        variant: "destructive",
      });
      return;
    }

    setGlobalMonitoringSaving(true);
    try {
      const settings = await updateGlobalProductMonitoringSettings({
        enabled: Boolean(globalMonitoringForm.enabled),
        intervalMinutes,
      });
      setGlobalMonitoringSettings(settings);
      setGlobalMonitoringForm({
        enabled: Boolean(settings.enabled),
        intervalMinutes: String(settings.intervalMinutes),
      });
      toast({
        title: "Monitoring settings updated",
      });
      setGlobalMonitoringDialogOpen(false);
    } catch (error) {
      toast({
        title: "Failed to update monitoring settings",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setGlobalMonitoringSaving(false);
    }
  };

  const handleSaveProductMonitoring = async () => {
    if (!editing?.id) {
      return;
    }

    const customInterval = Number(productMonitoringForm.intervalMinutes);
    if (!productMonitoringForm.useGlobalInterval && (!Number.isFinite(customInterval) || customInterval < 5)) {
      toast({
        title: "Custom monitoring time must be at least 5 minutes",
        variant: "destructive",
      });
      return;
    }

    setProductMonitoringSaving(true);
    try {
      await updateProductMonitoringSettings(editing.id, {
        intervalMinutes: productMonitoringForm.useGlobalInterval ? null : customInterval,
      });
      const refreshed = await getProductSourceInfo(editing.id);
      setSourceInfo(refreshed);
      toast({
        title: "Product monitoring updated",
      });
    } catch (error) {
      toast({
        title: "Failed to update product monitoring",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setProductMonitoringSaving(false);
    }
  };

  if (loading) return <div className="space-y-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-16 bg-secondary rounded-xl animate-pulse"/>)}</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} total products</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <Button variant="outline" onClick={handleOpenImportDialog} className="rounded-full" disabled={importingCsv || previewingCsv}>
            <Upload className={`w-4 h-4 mr-2 ${importingCsv || previewingCsv ? "animate-pulse" : ""}`} />
            Import CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setGlobalMonitoringDialogOpen(true)}
            className="rounded-full"
          >
            <Clock3 className="w-4 h-4 mr-2" />
            Monitoring Time
          </Button>
          <Button variant="outline" onClick={() => setExportDialogOpen(true)} className="rounded-full">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={openNew} className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Add Product</Button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-10 bg-secondary border-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">PRODUCT</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden md:table-cell">BRAND</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden lg:table-cell">PRICE</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden lg:table-cell">SOURCE URL</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground hidden lg:table-cell">PRODUCT URL</th>
                <th className="text-left px-4 py-3 font-medium text-xs tracking-widest text-muted-foreground">STATUS</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const storefrontUrl = `/products/${p.slug || p.id}`;

                return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium truncate block max-w-[200px]">{p.title}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.brand}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-mono text-[hsl(var(--accent))]">${p.final_price?.toFixed(2)}</span>
                    <span className="text-muted-foreground line-through ml-2 text-xs">${p.original_price?.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.source_url ? (
                      <a
                        href={p.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-[220px] truncate text-[11px] text-primary hover:underline"
                        title={p.source_url}
                      >
                        {p.source_url}
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <a
                      href={storefrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block max-w-[220px] truncate text-[11px] text-primary hover:underline"
                      title={storefrontUrl}
                    >
                      {storefrontUrl}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={p.status === "active" ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]" : ""}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleManualUpdate(p)}
                          disabled={!p.source_url || Boolean(manualUpdatingIds[p.id])}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${manualUpdatingIds[p.id] ? "animate-spin" : ""}`} />
                          Manual Update
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(p)}><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleVisibility(p)}>{p.status === "active" ? <><EyeOff className="w-4 h-4 mr-2" />Hide</> : <><Eye className="w-4 h-4 mr-2" />Show</>}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteProduct(p.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={globalMonitoringDialogOpen} onOpenChange={setGlobalMonitoringDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Monitoring Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monitoring status</span>
                <Badge variant="secondary" className={globalMonitoringForm.enabled ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]" : ""}>
                  {globalMonitoringForm.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Default interval: {globalMonitoringSettings ? formatIntervalMinutes(globalMonitoringSettings.intervalMinutes) : "—"}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable global monitoring</Label>
              <input
                type="checkbox"
                checked={globalMonitoringForm.enabled}
                onChange={(event) => setGlobalMonitoringForm((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={globalMonitoringLoading || globalMonitoringSaving}
              />
            </div>
            <div>
              <Label className="text-xs">Default monitoring interval (minutes)</Label>
              <Input
                type="number"
                min="5"
                value={globalMonitoringForm.intervalMinutes}
                onChange={(event) => setGlobalMonitoringForm((current) => ({ ...current, intervalMinutes: event.target.value }))}
                className="mt-1"
                disabled={globalMonitoringLoading || globalMonitoringSaving}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the default time used for all monitored products unless a product has its own custom interval.
              </p>
            </div>
            <Button
              onClick={handleSaveGlobalMonitoring}
              className="w-full rounded-full"
              disabled={globalMonitoringLoading || globalMonitoringSaving}
            >
              {globalMonitoringSaving ? "Saving..." : "Save Monitoring Time"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Export CSV by Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">All Brands</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Export all products with the current CSV structure and columns.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={exportAllBrands}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setExportAllBrands(nextChecked);
                    if (nextChecked) {
                      setSelectedExportBrandIds([]);
                    }
                  }}
                />
              </div>
            </div>

            <div className={`rounded-xl border border-border p-4 space-y-3 ${exportAllBrands ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Selected Brands</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick one or more brands to export only their products.
                  </p>
                </div>
                <Badge variant="secondary">{selectedExportBrandIds.length}</Badge>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {brands.map((brand) => {
                  const checked = selectedExportBrandIds.includes(brand.id);

                  return (
                    <label
                      key={brand.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        checked ? "border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10" : "border-border bg-card"
                      } ${exportAllBrands ? "cursor-not-allowed" : "cursor-pointer hover:bg-secondary/40"}`}
                    >
                      <span className="truncate">{brand.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={exportAllBrands}
                        onChange={(event) => {
                          const nextChecked = event.target.checked;
                          setExportAllBrands(false);
                          setSelectedExportBrandIds((current) =>
                            nextChecked
                              ? [...current, brand.id]
                              : current.filter((brandId) => brandId !== brand.id),
                          );
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={exportingCsv}>
                Cancel
              </Button>
              <Button onClick={() => void exportProductsMapping()} disabled={exportingCsv}>
                {exportingCsv ? "Exporting..." : "Export CSV"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            resetImportDialog();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Import CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand / Site</Label>
                <Select
                  value={importSelection.brandId || undefined}
                  onValueChange={(value) => {
                    setImportSelection((current) => ({ ...current, brandId: value }));
                    setImportPreview(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand / site" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Main Category</Label>
                <Select
                  value={importSelection.mainCategoryId || undefined}
                  onValueChange={(value) => {
                    setImportSelection((current) => ({
                      ...current,
                      mainCategoryId: value,
                      subcategoryId: "",
                    }));
                    setImportPreview(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select main category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainImportCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select
                  value={importSelection.subcategoryId || "__none__"}
                  onValueChange={(value) => {
                    setImportSelection((current) => ({
                      ...current,
                      subcategoryId: value === "__none__" ? "" : value,
                    }));
                    setImportPreview(null);
                  }}
                  disabled={!importSelection.mainCategoryId || importSubcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No subcategory</SelectItem>
                    {importSubcategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Products will be assigned to the selected subcategory when one is chosen.
                </p>
              </div>

              <div className="space-y-2">
                <Label>CSV File</Label>
                <Button type="button" variant="outline" onClick={handleChooseImportFile} className="w-full md:min-w-44">
                  <Upload className="mr-2 h-4 w-4" />
                  {importFile ? "Change File" : "Choose CSV"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Selected Brand / Site</p>
                  <p className="mt-1 font-medium">{selectedImportBrand?.name || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Destination Category</p>
                  <p className="mt-1 font-medium">{importDestinationLabel || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Selected File</p>
                  <p className="mt-1 font-medium break-all">{importFile?.name || "No file selected"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3">
              <div>
                <p className="font-medium">Existing Category Hierarchy</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Category controls only where the imported products will be assigned and replaced within this brand/site scope.
                </p>
              </div>
              <div className="max-h-40 space-y-3 overflow-y-auto pr-1 text-sm">
                {importCategoryHierarchy.map((category) => (
                  <div key={category.id}>
                    <p className={`font-medium ${selectedMainImportCategory?.id === category.id ? "text-foreground" : ""}`}>
                      {category.name}
                    </p>
                    {category.children.length > 0 ? (
                      <div className="mt-1 space-y-1 pl-4 text-muted-foreground">
                        {category.children.map((child) => (
                          <p
                            key={child.id}
                            className={selectedDestinationCategory?.id === child.id ? "text-foreground font-medium" : ""}
                          >
                            - {child.name}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 pl-4 text-muted-foreground">- No subcategories</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {importPreview ? (
              <div className="space-y-4 rounded-xl border border-border p-4">
                <div className="space-y-1">
                  <p className="font-medium">Preview</p>
                  <p className="text-sm text-muted-foreground">
                    {importPreview.confirmationMessage || "Review the validation results below before continuing."}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Previous Matching</p>
                    <p className="mt-2 font-display text-2xl">{importPreview.summary.previousMatchingProductCount}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Skipped</p>
                    <p className="mt-2 font-display text-2xl">{importPreview.summary.skipped}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Failed</p>
                    <p className="mt-2 font-display text-2xl">{importPreview.summary.failed}</p>
                  </div>
                </div>

                {importPreview.issues.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Row-level issues</p>
                    <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
                      {importPreview.issues.map((issue) => (
                        <div key={`${issue.status}-${issue.rowNumber}-${issue.reason}`} className="rounded-xl border border-border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">Row {issue.rowNumber}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{issue.reason}</p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                issue.status === "FAILED"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-700"
                              }
                            >
                              {issue.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={previewingCsv || importingCsv}>
                Cancel
              </Button>
              <Button onClick={() => void handlePreviewImport()} disabled={!canPreviewImport || previewingCsv || importingCsv || referenceLoading}>
                {previewingCsv ? "Validating..." : "Validate CSV"}
              </Button>
              <Button onClick={() => void handleConfirmImport()} disabled={!importPreview?.readyToImport || importingCsv}>
                {importingCsv ? "Importing..." : "Continue Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importResultDialogOpen} onOpenChange={setImportResultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">CSV Import Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Brand / Site</p>
                  <p className="mt-1 font-medium">{importResult?.selection?.brand?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Category / Subcategory</p>
                  <p className="mt-1 font-medium">
                    {importResult?.selection?.mainCategory?.name ?? "—"}
                    {importResult?.selection?.destinationCategory?.id &&
                    importResult?.selection?.destinationCategory?.id !== importResult?.selection?.mainCategory?.id
                      ? ` / ${importResult.selection.destinationCategory.name}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Previous Matching", value: importResult?.summary?.previousMatchingProductCount ?? 0 },
                { label: "Deleted", value: importResult?.summary?.deleted ?? 0 },
                { label: "Imported", value: importResult?.summary?.imported ?? 0 },
                { label: "Updated", value: importResult?.summary?.updated ?? 0 },
                { label: "Skipped", value: importResult?.summary?.skipped ?? 0 },
                { label: "Failed", value: importResult?.summary?.failed ?? 0 },
                { label: "Final Product Count", value: importResult?.summary?.finalProductCount ?? 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  <p className="mt-2 font-display text-2xl">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              Total rows processed: <span className="font-medium text-foreground">{importResult?.summary?.total ?? 0}</span>
            </div>

            {importResult?.issues?.length ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Row-level issues</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Skipped and failed rows are listed below with their row number and reason.
                  </p>
                </div>
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {importResult.issues.map((issue) => (
                    <div key={`${issue.status}-${issue.rowNumber}-${issue.reason}`} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">Row {issue.rowNumber}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{issue.reason}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            issue.status === "FAILED"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-700"
                          }
                        >
                          {issue.status}
                        </Badge>
                      </div>
                      {(issue.title || issue.sourceUrl) ? (
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {issue.title ? <p>Title: <span className="text-foreground">{issue.title}</span></p> : null}
                          {issue.sourceUrl ? <p className="break-all">SourceURL: <span className="text-foreground">{issue.sourceUrl}</span></p> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                No row-level issues. The selected brand/category scope imported cleanly.
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setImportResultDialogOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "Add"} Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editing && sourceInfo ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Source Information</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Source Store</span>
                  <span className="text-right text-foreground">{sourceInfo.sourceStore || "—"}</span>
                  <span>Supplier Price</span>
                  <span className="text-right text-foreground">{formatCurrency(sourceInfo.supplierPrice || 0, "EUR")}</span>
                  <span>Imported Date</span>
                  <span className="text-right text-foreground">{sourceInfo.importedAt ? new Date(sourceInfo.importedAt).toLocaleString() : "—"}</span>
                  <span>Last Sync Date</span>
                  <span className="text-right text-foreground">{sourceInfo.lastSyncDate ? new Date(sourceInfo.lastSyncDate).toLocaleString() : "—"}</span>
                </div>
                {sourceInfo.sourceUrl ? (
                  <a href={sourceInfo.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">
                    {sourceInfo.sourceUrl}
                  </a>
                ) : null}
              </div>
            ) : null}
            {editing && sourceInfo?.monitoring ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">Product Monitoring</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set a custom time for this product or let it use the global default.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleManualUpdate(editing)}
                    disabled={!sourceInfo.sourceUrl || Boolean(manualUpdatingIds[editing.id])}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${manualUpdatingIds[editing.id] ? "animate-spin" : ""}`} />
                    Manual Update
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Global default</span>
                  <span className="text-right text-foreground">
                    {globalMonitoringSettings ? formatIntervalMinutes(globalMonitoringSettings.intervalMinutes) : "—"}
                  </span>
                  <span>Current interval</span>
                  <span className="text-right text-foreground">{formatIntervalMinutes(sourceInfo.monitoring.intervalMinutes)}</span>
                  <span>Last checked</span>
                  <span className="text-right text-foreground">{formatDateTime(sourceInfo.monitoring.lastCheckedAt)}</span>
                  <span>Next scheduled</span>
                  <span className="text-right text-foreground">{formatDateTime(sourceInfo.monitoring.nextScheduledCheck)}</span>
                  <span>Latest result</span>
                  <span className="text-right text-foreground">{sourceInfo.monitoring.latestLog?.status ?? "—"}</span>
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <Label>Use global time</Label>
                    <input
                      type="checkbox"
                      checked={productMonitoringForm.useGlobalInterval}
                      onChange={(event) =>
                        setProductMonitoringForm((current) => ({
                          ...current,
                          useGlobalInterval: event.target.checked,
                          intervalMinutes: event.target.checked
                            ? String(globalMonitoringSettings?.intervalMinutes ?? sourceInfo.monitoring.intervalMinutes)
                            : current.intervalMinutes || String(sourceInfo.monitoring.intervalMinutes),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Custom interval (minutes)</Label>
                    <Input
                      type="number"
                      min="5"
                      value={productMonitoringForm.intervalMinutes}
                      onChange={(event) =>
                        setProductMonitoringForm((current) => ({
                          ...current,
                          intervalMinutes: event.target.value,
                        }))
                      }
                      className="mt-1"
                      disabled={productMonitoringForm.useGlobalInterval}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveProductMonitoring}
                    className="w-full rounded-full"
                    disabled={productMonitoringSaving || !sourceInfo.sourceUrl}
                  >
                    {productMonitoringSaving ? "Saving..." : "Save Product Monitoring Time"}
                  </Button>
                </div>
              </div>
            ) : null}
            {[{k:"title",l:"Title"},{k:"sku",l:"SKU"},{k:"original_price",l:"Original Price",t:"number"},{k:"outlet_price",l:"Outlet Price",t:"number"},{k:"final_price",l:"Final Price",t:"number"},{k:"stock",l:hasVariantAvailability ? "Stock (auto from variants)" : "Stock",t:"number",disabled:hasVariantAvailability},{k:"source_store",l:"Source Store"},{k:"source_url",l:"Source URL"}].map(f=>(
              <div key={f.k}>
                <Label className="text-xs">{f.l}</Label>
                <Input
                  type={f.t||"text"}
                  value={f.k === "stock" && hasVariantAvailability ? String(variantSummary.totalStock) : form[f.k]}
                  onChange={e=>setForm({...form,[f.k]:e.target.value})}
                  className="mt-1"
                  disabled={Boolean(f.disabled)}
                />
              </div>
            ))}
            <div>
              <Label className="text-xs">Brand</Label>
              <Select
                value={brandSelectValue}
                onValueChange={(value) => {
                  if (value === CUSTOM_OPTION_VALUE) {
                    setBrandInputMode(true);
                    return;
                  }

                  setBrandInputMode(false);
                  setForm({ ...form, brand: value });
                }}
                disabled={referenceLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={referenceLoading ? "Loading brands..." : "Select a brand"} />
                </SelectTrigger>
                <SelectContent>
                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.name}>
                        {brand.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_brands__" disabled>
                      No brands created yet
                    </SelectItem>
                  )}
                  <SelectItem value={CUSTOM_OPTION_VALUE}>Custom brand</SelectItem>
                </SelectContent>
              </Select>
              {(brandInputMode || brands.length === 0) ? (
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="mt-2"
                  placeholder="Type brand name"
                />
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={categorySelectValue}
                onValueChange={(value) => {
                  if (value === CUSTOM_OPTION_VALUE) {
                    setCategoryInputMode(true);
                    return;
                  }

                  setCategoryInputMode(false);
                  setForm({ ...form, category: value });
                }}
                disabled={referenceLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={referenceLoading ? "Loading categories..." : "Select a category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_categories__" disabled>
                      No categories created yet
                    </SelectItem>
                  )}
                  <SelectItem value={CUSTOM_OPTION_VALUE}>Custom category</SelectItem>
                </SelectContent>
              </Select>
              {(categoryInputMode || categories.length === 0) ? (
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-2"
                  placeholder="Type category name"
                />
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Product Images</Label>
              <Textarea
                value={form.image_urls_text}
                onChange={e=>setForm({...form,image_urls_text:e.target.value})}
                className="mt-1"
                rows={5}
                placeholder="Add one image URL per line"
              />
              <p className="mt-1 text-xs text-muted-foreground">Add one image URL per line. The first image becomes the main product image.</p>
            </div>
            {imagePreviews.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {imagePreviews.map((imageUrl) => (
                  <div key={imageUrl} className="aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1" rows={3} />
            </div>
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-xs">Color Size Availability (Optional)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add colors, sizes, and stock only if you want to track variants for this product.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantGroups((current) => [...current, createVariantGroup()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Color
                </Button>
              </div>
              <div className="space-y-3">
                {variantGroups.map((group, groupIndex) => (
                  <div key={group.id} className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-xs">Color (Optional)</Label>
                        <Input
                          value={group.color}
                          onChange={(e) =>
                            setVariantGroups((current) =>
                              current.map((entry, index) =>
                                index === groupIndex ? { ...entry, color: e.target.value } : entry,
                              ),
                            )
                          }
                          className="mt-1"
                          placeholder="Black"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-5"
                        onClick={() =>
                          setVariantGroups((current) =>
                            current.length === 1 ? [createVariantGroup()] : current.filter((_, index) => index !== groupIndex),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item, itemIndex) => (
                        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2 items-end">
                          <div>
                            <Label className="text-xs">Size (Optional)</Label>
                            <Input
                              value={item.size}
                              onChange={(e) =>
                                setVariantGroups((current) =>
                                  current.map((entry, index) =>
                                    index === groupIndex
                                      ? {
                                          ...entry,
                                          items: entry.items.map((row, rowIndex) =>
                                            rowIndex === itemIndex ? { ...row, size: e.target.value } : row,
                                          ),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              className="mt-1"
                              placeholder="32"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Stock (Optional)</Label>
                            <Input
                              type="number"
                              value={item.stockQuantity}
                              onChange={(e) =>
                                setVariantGroups((current) =>
                                  current.map((entry, index) =>
                                    index === groupIndex
                                      ? {
                                          ...entry,
                                          items: entry.items.map((row, rowIndex) =>
                                            rowIndex === itemIndex ? { ...row, stockQuantity: e.target.value } : row,
                                          ),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              className="mt-1"
                              min="0"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setVariantGroups((current) =>
                                current.map((entry, index) =>
                                  index === groupIndex
                                    ? {
                                        ...entry,
                                        items:
                                          entry.items.length === 1
                                            ? [createVariantItem()]
                                            : entry.items.filter((_, rowIndex) => rowIndex !== itemIndex),
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setVariantGroups((current) =>
                          current.map((entry, index) =>
                            index === groupIndex
                              ? { ...entry, items: [...entry.items, createVariantItem()] }
                              : entry,
                          ),
                        )
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Size
                    </Button>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                Colors: {variantSummary.colorsText || "—"} | Sizes: {variantSummary.sizesText || "—"} | Total stock: {variantSummary.totalStock}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Gender</Label>
                <Select value={form.gender} onValueChange={v=>setForm({...form,gender:v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="men">Men</SelectItem>
                    <SelectItem value="women">Women</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                    <SelectItem value="kids">Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Stock Status</Label>
                <Select value={form.stock_status} onValueChange={v=>setForm({...form,stock_status:v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Featured Product</Label>
                <input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Custom Pricing Override</Label>
                  <p className="text-xs text-muted-foreground mt-1">If enabled, customer price uses the custom value and ignores the Global Business Settings pricing flow.</p>
                </div>
                <input type="checkbox" checked={form.use_custom_pricing} onChange={e=>setForm({...form,use_custom_pricing:e.target.checked})} />
              </div>
              <div>
                <Label className="text-xs">Custom Price</Label>
                <Input type="number" value={form.custom_price} onChange={e=>setForm({...form,custom_price:e.target.value})} className="mt-1" disabled={!form.use_custom_pricing} />
              </div>
            </div>
            <Button onClick={save} className="w-full rounded-full" disabled={saving}>
              {saving ? (editing ? "Updating..." : "Creating...") : (editing ? "Update" : "Create")} Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
