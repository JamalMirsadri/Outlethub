import ReactDOM from "react-dom/client";

import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initErrorReporter } from "@/services/error-reporter";
import "@/index.css";
import "@/i18n";

initErrorReporter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
