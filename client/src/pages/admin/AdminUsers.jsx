import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminResetUserPassword,
  deleteAdminUser,
  getAdminUserDetail,
  listAdminUsers,
  revokeAdminUserSessions,
  updateAdminUserStatus,
} from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";
import {
  Eye,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
  User2,
} from "lucide-react";
import moment from "moment";

const STATUS_OPTIONS = ["ALL", "ACTIVE", "PENDING", "SUSPENDED", "DELETED"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "lastLogin", label: "Last Login" },
];

const USER_STATUS_STYLES = {
  ACTIVE: "bg-emerald-500/10 text-emerald-500",
  PENDING: "bg-amber-500/10 text-amber-500",
  SUSPENDED: "bg-red-500/10 text-red-500",
  DELETED: "bg-muted text-muted-foreground",
};

const ORDER_STATUS_STYLES = {
  PENDING: "bg-blue-500/10 text-blue-500",
  PAYMENT_APPROVED: "bg-violet-500/10 text-violet-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PROCESSING: "bg-yellow-500/10 text-yellow-500",
  PURCHASED_FROM_SUPPLIER: "bg-purple-500/10 text-purple-500",
  SHIPPED: "bg-cyan-500/10 text-cyan-500",
  DELIVERED: "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-red-500/10 text-red-500",
};

const PAYMENT_STATUS_STYLES = {
  PAYMENT_PENDING_REVIEW: "bg-amber-500/10 text-amber-500",
  PAYMENT_APPROVED: "bg-emerald-500/10 text-emerald-500",
  PAID: "bg-emerald-500/10 text-emerald-500",
  PAYMENT_FAILED: "bg-red-500/10 text-red-500",
  REFUNDED: "bg-muted text-muted-foreground",
};

const EMPTY_USERS_RESPONSE = {
  items: [],
  summary: {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    suspendedUsers: 0,
    deletedUsers: 0,
    waitingPaymentUsers: 0,
    waitingApprovalUsers: 0,
    waitingReceiveUsers: 0,
  },
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  },
};

function formatStatusLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value) {
  return value ? moment(value).format("MMM D, YYYY • HH:mm") : "Never";
}

function formatShortDate(value) {
  return value ? moment(value).format("MMM D, YYYY") : "Never";
}

function getDisplayName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unnamed customer";
}

function getWaitingBadges(order) {
  const labels = [];
  if (order.waitingPayment) labels.push("Waiting Payment");
  if (order.waitingApproval) labels.push("Waiting Approval");
  if (order.waitingReceive) labels.push("Waiting Receive");
  return labels;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function AdminUsers() {
  const [usersResponse, setUsersResponse] = useState(EMPTY_USERS_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setReloading(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await listAdminUsers({
          search,
          status: statusFilter,
          sort,
          page,
          pageSize: 20,
        });
        setUsersResponse(response);
      } catch (error) {
        toast({
          title: "Unable to load users",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [page, search, sort, statusFilter],
  );

  const loadUserDetail = useCallback(async (userId, { silent = false } = {}) => {
    if (!silent) {
      setDetailLoading(true);
    }

    try {
      const detail = await getAdminUserDetail(userId);
      setSelectedUser(detail);
      return detail;
    } catch (error) {
      toast({
        title: "Unable to load user detail",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectedSummary = useMemo(
    () => usersResponse.items.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, usersResponse.items],
  );

  const openUserDetail = async (user) => {
    setSelectedUserId(user.id);
    setSelectedUser(null);
    setPasswordForm({
      newPassword: "",
      confirmPassword: "",
    });
    setDetailOpen(true);
    await loadUserDetail(user.id);
  };

  const refreshSelectedUser = async () => {
    if (!selectedUserId) {
      return;
    }

    await Promise.all([loadUsers({ silent: true }), loadUserDetail(selectedUserId, { silent: true })]);
  };

  const submitSearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const handleStatusUpdate = async (nextStatus) => {
    if (!selectedUserId) {
      return;
    }

    setActionLoading(`status-${nextStatus}`);
    try {
      await updateAdminUserStatus(selectedUserId, nextStatus);
      await refreshSelectedUser();
      toast({
        title: "User updated",
        description: `Account status changed to ${formatStatusLabel(nextStatus)}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update user",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserId) {
      return;
    }

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: "Password required",
        description: "Enter and confirm the new password first.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading("password");
    try {
      await adminResetUserPassword(selectedUserId, passwordForm);
      setPasswordForm({
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Password changed",
        description: "The customer can use the new password immediately.",
      });
    } catch (error) {
      toast({
        title: "Password reset failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const handleRevokeSessions = async () => {
    if (!selectedUserId) {
      return;
    }

    setActionLoading("sessions");
    try {
      await revokeAdminUserSessions(selectedUserId);
      await refreshSelectedUser();
      toast({
        title: "Sessions revoked",
        description: "All active user sessions have been signed out.",
      });
    } catch (error) {
      toast({
        title: "Unable to revoke sessions",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) {
      return;
    }

    setActionLoading("delete");
    try {
      await deleteAdminUser(selectedUserId);
      setDeleteDialogOpen(false);
      await refreshSelectedUser();
      toast({
        title: "User removed",
        description: "The account has been marked as deleted and access is blocked.",
      });
    } catch (error) {
      toast({
        title: "Unable to remove user",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading("");
    }
  };

  const summaryCards = [
    {
      label: "Total Users",
      value: usersResponse.summary.totalUsers,
      hint: `${usersResponse.summary.activeUsers} active accounts`,
    },
    {
      label: "Waiting Payment",
      value: usersResponse.summary.waitingPaymentUsers,
      hint: "Need payment from customer",
    },
    {
      label: "Waiting Approval",
      value: usersResponse.summary.waitingApprovalUsers,
      hint: "Payment uploaded, admin review pending",
    },
    {
      label: "Waiting Receive",
      value: usersResponse.summary.waitingReceiveUsers,
      hint: "Paid orders not delivered yet",
    },
    {
      label: "Suspended",
      value: usersResponse.summary.suspendedUsers,
      hint: `${usersResponse.summary.deletedUsers} deleted accounts`,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage shopping accounts, user access, order state, payments, addresses, and sessions.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadUsers({ silent: true })} disabled={reloading}>
          {reloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
              placeholder="Search by email, name, or phone..."
              className="pl-10"
            />
          </div>
          <Button onClick={submitSearch}>Search</Button>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full xl:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : formatStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full xl:w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">USER</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">STATUS</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">JOINED</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">LAST LOGIN</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">SHOPPING</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">WAITING</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">SPENT</th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-[0.22em] text-muted-foreground">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {usersResponse.items.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold">{getDisplayName(user)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.phone || "No phone"} • {user.preferredCurrency}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="secondary" className={USER_STATUS_STYLES[user.status] || "bg-secondary text-foreground"}>
                      {formatStatusLabel(user.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatShortDate(user.createdAt)}</td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDateTime(user.lastLoginAt)}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p>{user.stats.ordersCount} orders</p>
                      <p className="text-xs text-muted-foreground">{user.stats.deliveredCount} delivered • {user.stats.cancelledCount} cancelled</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1 text-xs">
                      <p>Payment: {user.stats.waitingPaymentCount}</p>
                      <p>Approval: {user.stats.waitingApprovalCount}</p>
                      <p>Receive: {user.stats.waitingReceiveCount}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono">{formatCurrency(user.stats.totalSpent, user.preferredCurrency)}</td>
                  <td className="px-4 py-4">
                    <Button variant="outline" size="sm" onClick={() => openUserDetail(user)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {usersResponse.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No users found for the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page {usersResponse.pagination.page} of {Math.max(usersResponse.pagination.totalPages, 1)} • {usersResponse.pagination.total} users
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={usersResponse.pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={usersResponse.pagination.page >= usersResponse.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDeleteDialogOpen(false);
            setActionLoading("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">User Detail</DialogTitle>
            <DialogDescription>
              Customer account overview, shopping activity, payment flow, addresses, and admin controls.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && !selectedUser ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : selectedUser ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
                <div className="rounded-2xl border border-border p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                        <User2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{getDisplayName(selectedUser)}</h2>
                          <Badge variant="secondary" className={USER_STATUS_STYLES[selectedUser.status] || "bg-secondary text-foreground"}>
                            {formatStatusLabel(selectedUser.status)}
                          </Badge>
                          {!selectedUser.emailVerified ? <Badge variant="secondary">Email Unverified</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedUser.email}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedUser.phone || "No phone"} • Joined {formatShortDate(selectedUser.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedUser.status === "ACTIVE" ? "secondary" : "default"}
                        disabled={actionLoading === "status-ACTIVE"}
                        onClick={() => handleStatusUpdate("ACTIVE")}
                      >
                        {actionLoading === "status-ACTIVE" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Activate
                      </Button>
                      <Button
                        variant="outline"
                        disabled={actionLoading === "status-SUSPENDED"}
                        onClick={() => handleStatusUpdate("SUSPENDED")}
                      >
                        {actionLoading === "status-SUSPENDED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldX className="mr-2 h-4 w-4" />}
                        Disable
                      </Button>
                      <Button variant="outline" disabled={actionLoading === "sessions"} onClick={handleRevokeSessions}>
                        {actionLoading === "sessions" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Revoke Sessions
                      </Button>
                      <Button variant="destructive" disabled={actionLoading === "delete"} onClick={() => setDeleteDialogOpen(true)}>
                        {actionLoading === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Sessions</p>
                    <p className="mt-3 text-2xl font-semibold">{selectedUser.sessionCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Active login sessions</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Last Login</p>
                    <p className="mt-3 text-lg font-semibold">{formatDateTime(selectedUser.lastLoginAt)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Own dashboard stays isolated to this account</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Orders" value={selectedUser.stats.ordersCount} hint={`${selectedUser.stats.deliveredCount} delivered`} />
                <StatCard
                  label="Spent"
                  value={formatCurrency(selectedUser.stats.totalSpent, selectedUser.preferredCurrency)}
                  hint={`Refunded ${formatCurrency(selectedUser.stats.totalRefunded, selectedUser.preferredCurrency)}`}
                />
                <StatCard label="Waiting Payment" value={selectedUser.stats.waitingPaymentCount} hint="Customer action required" />
                <StatCard label="Waiting Receive" value={selectedUser.stats.waitingReceiveCount} hint={`${selectedUser.stats.waitingApprovalCount} approval pending`} />
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="addresses">Addresses</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border p-5">
                      <h3 className="font-semibold">Account Detail</h3>
                      <div className="mt-4 grid gap-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Customer Name</span>
                          <span>{getDisplayName(selectedUser)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Email</span>
                          <span>{selectedUser.email}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Phone</span>
                          <span>{selectedUser.phone || "Not provided"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Preferred Currency</span>
                          <span>{selectedUser.preferredCurrency}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Email Verification</span>
                          <span>{selectedUser.emailVerified ? "Verified" : "Not verified"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Created</span>
                          <span>{formatDateTime(selectedUser.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Updated</span>
                          <span>{formatDateTime(selectedUser.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border p-5">
                      <h3 className="font-semibold">Shopping Pipeline</h3>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Waiting Payment</p>
                          <p className="mt-2 text-2xl font-semibold">{selectedUser.stats.waitingPaymentCount}</p>
                        </div>
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Waiting Approval</p>
                          <p className="mt-2 text-2xl font-semibold">{selectedUser.stats.waitingApprovalCount}</p>
                        </div>
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Waiting Receive</p>
                          <p className="mt-2 text-2xl font-semibold">{selectedUser.stats.waitingReceiveCount}</p>
                        </div>
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cancelled</p>
                          <p className="mt-2 text-2xl font-semibold">{selectedUser.stats.cancelledCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      <h3 className="font-semibold">Change Password</h3>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="admin-user-new-password">New Password</Label>
                        <Input
                          id="admin-user-new-password"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                          }
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="admin-user-confirm-password">Confirm Password</Label>
                        <Input
                          id="admin-user-confirm-password"
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button onClick={handleResetPassword} disabled={actionLoading === "password"}>
                        {actionLoading === "password" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                        Save New Password
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="space-y-4">
                  {selectedUser.orders.length === 0 ? (
                    <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
                      This customer has no shopping orders yet.
                    </div>
                  ) : (
                    selectedUser.orders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-border p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{order.orderNumber}</h3>
                              <Badge variant="secondary" className={ORDER_STATUS_STYLES[order.status] || "bg-secondary text-foreground"}>
                                {formatStatusLabel(order.status)}
                              </Badge>
                              {getWaitingBadges(order).map((label) => (
                                <Badge key={label} variant="secondary">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Created {formatDateTime(order.createdAt)} • Payment {order.paymentStatus ? formatStatusLabel(order.paymentStatus) : "N/A"}
                            </p>
                          </div>
                          <div className="text-left lg:text-right">
                            <p className="font-mono text-lg">{formatCurrency(order.totalAmount, order.currency)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {order.itemCount} items • Refunded {formatCurrency(order.refundedAmount, order.currency)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Customer</p>
                            <p className="mt-1 font-medium">{order.customerName}</p>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Payment Provider</p>
                            <p className="mt-1 font-medium">{order.paymentProvider}</p>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Tracking</p>
                            <p className="mt-1 font-medium">{order.trackingNumber || "Not assigned"}</p>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Delivery ETA</p>
                            <p className="mt-1 font-medium">{order.estimatedDeliveryDate ? formatShortDate(order.estimatedDeliveryDate) : "Unknown"}</p>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex flex-col gap-3 rounded-xl bg-secondary/20 p-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium">{item.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.brandName || "Unknown brand"} • Qty {item.quantity}
                                </p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="font-mono">{formatCurrency(item.totalPrice, order.currency)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Unit {formatCurrency(item.unitPrice, order.currency)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                  {selectedUser.recentPayments.length === 0 ? (
                    <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
                      No payments recorded for this customer.
                    </div>
                  ) : (
                    selectedUser.recentPayments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-border p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{payment.provider}</h3>
                              <Badge variant="secondary" className={PAYMENT_STATUS_STYLES[payment.status] || "bg-secondary text-foreground"}>
                                {formatStatusLabel(payment.status)}
                              </Badge>
                              <Badge variant="secondary">{formatStatusLabel(payment.kind)}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Created {formatDateTime(payment.createdAt)} • Reference {payment.paymentReference || "N/A"}
                            </p>
                          </div>
                          <div className="text-left lg:text-right">
                            <p className="font-mono text-lg">{formatCurrency(payment.amount, payment.currency)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Order {payment.orderId || "Not linked"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Review Requested</p>
                            <p className="mt-1 font-medium">{payment.reviewRequestedAt ? formatDateTime(payment.reviewRequestedAt) : "Not requested"}</p>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Approved At</p>
                            <p className="mt-1 font-medium">{payment.approvedAt ? formatDateTime(payment.approvedAt) : "Not approved"}</p>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-muted-foreground">Processed At</p>
                            <p className="mt-1 font-medium">{payment.processedAt ? formatDateTime(payment.processedAt) : "Not processed"}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="addresses" className="space-y-4">
                  {selectedUser.addresses.length === 0 ? (
                    <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
                      No saved addresses for this customer.
                    </div>
                  ) : (
                    selectedUser.addresses.map((address) => (
                      <div key={address.id} className="rounded-2xl border border-border p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{address.fullName}</h3>
                          {address.isDefaultShipping ? <Badge variant="secondary">Default Shipping</Badge> : null}
                          {address.isDefaultBilling ? <Badge variant="secondary">Default Billing</Badge> : null}
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {address.addressLine1}
                          {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {address.city}, {address.postalCode}, {address.countryCode}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{address.phone || "No phone"}</p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Updated {formatDateTime(address.updatedAt)}
                        </p>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : selectedSummary ? (
            <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
              Loading details for {getDisplayName(selectedSummary)}...
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This blocks access, revokes active sessions, and marks the customer account as deleted without changing other website areas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionLoading === "delete"} onClick={handleDeleteUser}>
              {actionLoading === "delete" ? "Removing..." : "Remove Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
