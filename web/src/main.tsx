import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./styles.css";
import { configError } from "./lib/supabase";
import { AuthProvider } from "./lib/auth";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);

if (configError) {
  root.render(
    <StrictMode>
      <main className="content">
        <h1>Sync Lead Finder</h1>
        <div className="notice notice-error">{configError}</div>
      </main>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
