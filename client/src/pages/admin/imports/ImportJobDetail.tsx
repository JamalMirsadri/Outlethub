import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { getImportJobDetail, type ImportJobDetailResponse } from "@/api/imports";
import { Button } from "@/components/ui/button";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function ImportJobDetail() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ImportJobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!params.id) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      setDetail(await getImportJobDetail(params.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load import job detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (!detail) {
    return <div className="text-sm text-muted-foreground">Import job not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/admin/imports/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
          <h2 className="mt-2 font-semibold">Import Job Trace</h2>
          <p className="text-sm text-muted-foreground">
            {detail.job.source?.name ?? "Admin Upload"} · {detail.job.status} · Started {formatDateTime(detail.job.startedAt)}
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Discovery", detail.executionTrace.discovery],
          ["Fetch", detail.executionTrace.fetch],
          ["Normalize", detail.executionTrace.normalize],
          ["Validate", detail.executionTrace.validate],
          ["Upsert", detail.executionTrace.upsert],
          ["Catalog", detail.executionTrace.catalog],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">First 50 Processed Products</h3>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Status", "Product", "Brand", "Price", "Source", "Failure"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.firstProcessedProducts.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium">{item.status}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.productName ?? "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{item.category ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">{item.brand ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {item.currentPrice ?? "—"}
                      {item.oldPrice ? ` / ${item.oldPrice}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.sourceUrl ? (
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                          Open URL
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-400">{item.failureReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">Job Summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Imported", detail.job.importedCount],
                ["Updated", detail.job.updatedCount],
                ["Unchanged", detail.job.unchangedCount],
                ["Failed", detail.job.failedCount],
                ["Duration", detail.processingDurationMs ? `${Math.round(detail.processingDurationMs / 1000)}s` : "—"],
                ["Completed", formatDateTime(detail.job.completedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                  <span>{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">Connector Diagnostics</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                <span>Strategy</span>
                <span className="font-mono">{detail.connectorRun?.strategyUsed ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                <span>HTTP Status</span>
                <span className="font-mono">{detail.connectorRun?.httpStatus ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                <span>Protection</span>
                <span className="font-mono">{detail.connectorRun?.protectionType ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">Catalog Verification</h3>
            <div className="mt-4 space-y-3">
              {detail.catalogRecords.map((product) => (
                <div key={product.id} className="rounded-lg bg-secondary/30 px-3 py-3 text-sm">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.brand} · {product.currentPrice} · {product.importStatus} · {formatDateTime(product.lastSync)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-all">{product.sourceUrl ?? "No source URL"}</div>
                </div>
              ))}
              {detail.catalogRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No catalog records linked to this job yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
