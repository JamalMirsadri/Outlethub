import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportFrontendError } from "@/services/error-reporter";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportFrontendError({
      message: error.message,
      severity: "HIGH",
      stack: error.stack ?? null,
      source: `${error.name} (React: ${info.componentStack?.trim().slice(0, 500) ?? "unknown"})`,
    });
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
