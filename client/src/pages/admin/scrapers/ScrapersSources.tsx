import React, { useEffect, useState } from "react";

import { listScraperSources, type ScraperSourceRecord } from "@/api/scrapers";

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function ScrapersSources() {
  const [sources, setSources] = useState<ScraperSourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        setSources(await listScraperSources());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load scraper sources.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Scraper Sources</h2>
        <p className="text-sm text-muted-foreground">Connector definitions and browser/request architecture hooks.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}

      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-muted-foreground">
            No scraper sources found.
          </div>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{source.name}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {source.scraperType}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {source.connectorKey}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {source.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last run: {formatDateTime(source.lastRunAt)} | Runs: {source.runCount}
                </p>
                {source.website ? <p className="text-xs text-muted-foreground">{source.website}</p> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
