import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, MfaChallenge } from "./pages/Login";
import { OverviewPage } from "./pages/Overview";
import { SearchPage } from "./pages/Search";
import { SignalsPage } from "./pages/Signals";
import { CompaniesPage } from "./pages/Companies";
import { CompanyDetailPage } from "./pages/CompanyDetail";
import { CohortPage } from "./pages/Cohort";
import { DncPage } from "./pages/Dnc";
import { SettingsPage } from "./pages/Settings";
import { LogsPage } from "./pages/Logs";
import { TodayPage } from "./pages/Today";
import { PipelinePage } from "./pages/Pipeline";
import { ImportPage } from "./pages/Import";
import { MusicPage } from "./pages/Music";

function Guard() {
  const { loading, session, needsMfa } = useAuth();
  if (loading) return <main className="content"><Spinner /></main>;
  if (!session) return <Navigate to="/login" replace />;
  if (needsMfa) return <MfaChallenge />;
  return <Layout />;
}

export function App() {
  const { session, loading, needsMfa } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && session && !needsMfa ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<Guard />}>
        <Route index element={<OverviewPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="music" element={<MusicPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="signals" element={<SignalsPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="cohort" element={<CohortPage />} />
        <Route path="dnc" element={<DncPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="*" element={<p>Không tìm thấy trang.</p>} />
      </Route>
    </Routes>
  );
}
