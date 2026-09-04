import { useCallback, useEffect, useState } from "react";
import { Wallet as WalletIcon } from "lucide-react";

import {
  getWallet,
  listWalletTransactions,
  requestWithdrawal,
  type WalletTransactionView,
  type WalletView,
  type WithdrawalView,
} from "@/api/wallet";
import { getUserReferralSummary, type UserReferralSummary } from "@/api/referral-commissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function Wallet() {
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [referral, setReferral] = useState<UserReferralSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionView[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [walletData, transactionsData, referralData] = await Promise.all([
        getWallet(),
        listWalletTransactions({ page, pageSize: 10 }),
        getUserReferralSummary(),
      ]);
      setWallet(walletData);
      setTransactions(transactionsData.items);
      setReferral(referralData);
      setTotalPages(transactionsData.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onWithdraw = async () => {
    setBusy(true);
    setError("");
    try {
      await requestWithdrawal(amount);
      setAmount("");
      await load();
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : "Failed to request withdrawal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="luxe-panel p-6">
        <div className="flex items-center gap-2">
          <WalletIcon className="h-5 w-5" />
          <h2 className="font-display text-xl font-semibold">My Wallet</h2>
        </div>

        {error ? <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div> : null}

        {loading || !wallet ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-secondary" />
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
                <p className="mt-1 font-display text-3xl font-bold">€{wallet.balance}</p>
                <p className="text-xs text-muted-foreground">{wallet.currency}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet ID</p>
                <p className="mt-1 break-all font-mono text-sm">{wallet.walletId}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-1 font-display text-xl font-semibold">{wallet.status}</p>
              </div>
            </div>

            {referral ? (
              <div className="mt-6 rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Referral</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Code</p>
                    <p className="font-mono text-sm">{referral.referralCode ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rank</p>
                    <p className="font-medium">{referral.rank}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">L1 / L2 Rate</p>
                    <p className="font-medium">{referral.rates.level1Percentage}% / {referral.rates.level2Percentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Commission</p>
                    <p className="font-display text-xl font-bold">€{referral.commission.totalCommission}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Purchase & Referral Points</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Purchase:</span> {referral.points.purchaserPoints}</div>
                      <div><span className="text-muted-foreground">Level 1:</span> {referral.points.level1Points}</div>
                      <div><span className="text-muted-foreground">Level 2:</span> {referral.points.level2Points}</div>
                      <div><span className="text-muted-foreground">Level 3:</span> {referral.points.level3Points}</div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Commission by Level</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Level 1:</span> €{referral.commission.level1Commission}</div>
                      <div><span className="text-muted-foreground">Level 2:</span> €{referral.commission.level2Commission}</div>
                      <div><span className="text-muted-foreground">Direct:</span> {referral.referrals.directCount}</div>
                      <div><span className="text-muted-foreground">L2 / L3:</span> {referral.referrals.level2Count} / {referral.referrals.level3Count}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {referral && referral.recentCommissions.length > 0 ? (
              <div className="mt-6 rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Referral Commissions</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1">Order</th>
                        <th className="px-2 py-1">Level</th>
                        <th className="px-2 py-1">Rate</th>
                        <th className="px-2 py-1">Product Amount</th>
                        <th className="px-2 py-1">Commission</th>
                        <th className="px-2 py-1">Transaction ID</th>
                        <th className="px-2 py-1">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {referral.recentCommissions.map((commission) => (
                        <tr key={commission.id}>
                          <td className="px-2 py-1 font-medium">{commission.orderNumber}</td>
                          <td className="px-2 py-1">L{commission.referralLevel}</td>
                          <td className="px-2 py-1">{commission.percentage}%</td>
                          <td className="px-2 py-1">€{commission.eligibleProductAmount}</td>
                          <td className="px-2 py-1 font-medium">€{commission.commissionAmount}</td>
                          <td className="px-2 py-1 break-all font-mono text-xs">{commission.walletTransactionId}</td>
                          <td className="px-2 py-1 text-muted-foreground">{formatDateTime(commission.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Withdrawal amount (EUR)</p>
                <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div className="flex items-end">
                <Button onClick={() => void onWithdraw()} disabled={busy || !amount.trim()}>
                  Request Withdrawal
                </Button>
              </div>
            </div>

            {wallet.pendingWithdrawals && wallet.pendingWithdrawals.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Pending Withdrawals</h3>
                <div className="space-y-2">
                  {wallet.pendingWithdrawals.map((withdrawal: WithdrawalView) => (
                    <div key={withdrawal.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                      <span className="font-medium">€{withdrawal.amount}</span>
                      <span className="text-muted-foreground">{formatDateTime(withdrawal.requestedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="luxe-panel p-6">
        <h3 className="mb-3 text-sm font-semibold">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Balance After</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-3 py-2 font-medium">{transaction.type}</td>
                    <td className="px-3 py-2">€{transaction.amount}</td>
                    <td className="px-3 py-2">€{transaction.balanceAfter}</td>
                    <td className="px-3 py-2 text-muted-foreground">{transaction.description ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(transaction.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
