import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage, MfaChallenge } from "./pages/Login";

// Mỗi trang là một chunk riêng: lần đầu chỉ tải trang đang mở.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const TodayPage = page(() => import("./pages/Today"), "TodayPage");
const PipelinePage = page(() => import("./pages/Pipeline"), "PipelinePage");
const EmailLibraryPage = page(() => import("./pages/Library"), "EmailLibraryPage");
const ObjectionLibraryPage = page(() => import("./pages/Library"), "ObjectionLibraryPage");
const MusicPage = page(() => import("./pages/Music"), "MusicPage");
const SearchPage = page(() => import("./pages/Search"), "SearchPage");
const CompaniesPage = page(() => import("./pages/Companies"), "CompaniesPage");
const CompanyDetailPage = page(() => import("./pages/CompanyDetail"), "CompanyDetailPage");
const ImportPage = page(() => import("./pages/Import"), "ImportPage");
const CohortPage = page(() => import("./pages/Cohort"), "CohortPage");
const SettingsPage = page(() => import("./pages/Settings"), "SettingsPage");

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
        <Route index element={<TodayPage />} />
        <Route path="today" element={<Navigate to="/" replace />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="library/emails" element={<EmailLibraryPage />} />
        <Route path="library/objections" element={<ObjectionLibraryPage />} />
        <Route path="music" element={<MusicPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="cohort" element={<CohortPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Đường dẫn cũ */}
        <Route path="signals" element={<Navigate to="/settings?tab=signals" replace />} />
        <Route path="dnc" element={<Navigate to="/settings?tab=dnc" replace />} />
        <Route path="logs" element={<Navigate to="/settings?tab=logs" replace />} />
        <Route path="*" element={<p>Không tìm thấy trang.</p>} />
      </Route>
    </Routes>
  );
}
