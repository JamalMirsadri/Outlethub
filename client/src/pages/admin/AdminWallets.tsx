import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, Wallet as WalletIcon } from "lucide-react";

import {
  activateWallet,
  approveWithdrawal,
  completeWithdrawal,
  creditWallet,
  debitWallet,
  getAdminWallet,
  getWalletOverview,
  listWallets,
  listWithdrawals,
  rejectWithdrawal,
  suspendWallet,
  type WalletOverview,
  type WalletTransactionView,
  type WalletView,
  type WithdrawalView,
} from "@/api/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminWallets() {
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [wallets, setWallets] = useState<WalletView[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalView[]>([]);
  const [selected, setSelected] = useState<WalletView | null>(null);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewData, walletsData, withdrawalsData] = await Promise.all([
        getWalletOverview(),
        listWallets({ pageSize: 50, search: search || undefined }),
        listWithdrawals({ pageSize: 50 }),
      ]);
      setOverview(overviewData);
      setWallets(walletsData.items);
      setWithdrawals(withdrawalsData.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWallet = async (wallet: WalletView) => {
    setBusy(true);
    setError("");
    try {
      const detail = await getAdminWallet(wallet.walletId);
      setSelected(detail);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Failed to open wallet.");
    } finally {
      setBusy(false);
    }
  };

  const onCredit = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await creditWallet(selected.walletId, { amount, reason });
      setAmount("");
      setReason("");
      await openWallet(selected);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Credit failed.");
    } finally {
      setBusy(false);
    }
  };

  const onDebit = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await debitWallet(selected.walletId, { amount, reason });
      setAmount("");
      setReason("");
      await openWallet(selected);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Debit failed.");
    } finally {
      setBusy(false);
    }
  };

  const onSuspend = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await suspendWallet(selected.walletId);
      await openWallet(selected);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Suspend failed.");
    } finally {
      setBusy(false);
    }
  };

  const onActivate = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await activateWallet(selected.walletId);
      await openWallet(selected);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Activate failed.");
    } finally {
      setBusy(false);
    }
  };

  const onWithdrawalAction = async (id: string, action: "approve" | "reject" | "complete") => {
    setBusy(true);
    setError("");
    try {
      if (action === "approve") await approveWithdrawal(id);
      if (action === "reject") await rejectWithdrawal(id);
      if (action === "complete") await completeWithdrawal(id);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Withdrawal action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Wallets</h1>
          <p className="text-sm text-muted-foreground">Customer EUR wallets, ledger, and withdrawals.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Wallets" value={overview?.totalWallets ?? 0} />
        <Stat label="Active" value={overview?.activeWallets ?? 0} />
        <Stat label="Suspended" value={overview?.suspendedWallets ?? 0} />
        <Stat label="Total Balance" value={`€${overview?.totalBalance ?? "0.00"}`} />
        <Stat label="Pending Withdrawals" value={overview?.pendingWithdrawals ?? 0} />
        <Stat label="Total Credits" value={`€${overview?.totalCredits ?? "0.00"}`} />
        <Stat label="Total Debits" value={`€${overview?.totalDebits ?? "0.00"}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Wallets</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email / wallet ID" className="pl-10" />
            </div>
          </div>

          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-secondary" />
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallets found.</p>
          ) : (
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => void openWallet(wallet)}
                  className="flex w-full items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                >
                  <span className="truncate font-medium">{wallet.user?.email ?? wallet.walletId}</span>
                  <span className="shrink-0 font-mono">€{wallet.balance}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Withdrawals</h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawals.</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">€{withdrawal.amount}</span>
                    <Badge variant="secondary">{withdrawal.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{withdrawal.user?.email ?? withdrawal.walletId}</p>
                  {withdrawal.status === "PENDING" ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void onWithdrawalAction(withdrawal.id, "approve")} disabled={busy}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onWithdrawalAction(withdrawal.id, "reject")} disabled={busy}>
                        Reject
                      </Button>
                    </div>
                  ) : null}
                  {withdrawal.status === "APPROVED" ? (
                    <div className="mt-2">
                      <Button size="sm" onClick={() => void onWithdrawalAction(withdrawal.id, "complete")} disabled={busy}>
                        Mark Completed
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              <h2 className="font-display text-lg font-bold">Wallet Detail</h2>
            </div>
            <Badge variant="secondary">{selected.status}</Badge>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <InfoRow label="Wallet ID" value={selected.walletId} />
            <InfoRow label="Balance" value={`€${selected.balance}`} />
            <InfoRow label="Currency" value={selected.currency} />
            <InfoRow label="User" value={selected.user?.email ?? selected.userId} />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Amount (EUR)</p>
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">Reason</p>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void onCredit()} disabled={busy || !amount || !reason}>
                Credit
              </Button>
              <Button variant="destructive" onClick={() => void onDebit()} disabled={busy || !amount || !reason}>
                Debit
              </Button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {selected.status !== "SUSPENDED" ? (
              <Button variant="outline" onClick={() => void onSuspend()} disabled={busy}>
                Suspend
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void onActivate()} disabled={busy}>
                Activate
              </Button>
            )}
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Transactions</h3>
            {selected.transactions && selected.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Before</th>
                      <th className="px-3 py-2">After</th>
                      <th className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selected.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-2 font-medium">{transaction.type}</td>
                        <td className="px-3 py-2">€{transaction.amount}</td>
                        <td className="px-3 py-2">€{transaction.balanceBefore}</td>
                        <td className="px-3 py-2">€{transaction.balanceAfter}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDateTime(transaction.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium" title={value ?? undefined}>{value ?? "—"}</p>
    </div>
  );
}
