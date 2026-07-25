import { useEffect, type ReactElement } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import type { AppRole } from "@/types/auth";

const DefaultFallback = (): ReactElement => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

interface ProtectedRouteProps {
  fallback?: ReactElement;
  unauthenticatedElement: ReactElement;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      void checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError?.type === "forbidden") {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <UserNotRegisteredError />;
  }

  return <Outlet />;
}
