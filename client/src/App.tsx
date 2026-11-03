import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";

// Placeholder pages until F-03.2 (team views) and F-04 (milestones) land.
function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="muted">Coming in a later Sprint 1 feature.</p>
    </section>
  );
}

function ProtectedArea() {
  const { state } = useAuth();
  if (state.status === "loading") return <p className="content muted">Loading…</p>;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  return <AppShell user={state.user} />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedArea />}>
          <Route index element={<Placeholder title="Home" />} />
          <Route path="team" element={<Placeholder title="My team" />} />
          <Route path="teams" element={<Placeholder title="My teams" />} />
          <Route path="milestones" element={<Placeholder title="Milestones" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
