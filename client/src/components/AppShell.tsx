import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, type User } from "../auth/AuthContext";

// FR-04: navigation depends on the role the server returned, never on a client choice.
const NAV: Record<User["role"], Array<{ to: string; label: string }>> = {
  STUDENT: [
    { to: "/team", label: "My team" },
    { to: "/milestones", label: "Milestones" },
  ],
  SUPERVISOR: [
    { to: "/teams", label: "My teams" },
    { to: "/milestones", label: "Milestones" },
  ],
};

const ROLE_LABEL: Record<User["role"], string> = { STUDENT: "Student", SUPERVISOR: "Supervisor" };

export function AppShell({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Course Project Management</span>
        <nav aria-label="Main">
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="who">
          <span>{user.name}</span> <span className="muted">· {ROLE_LABEL[user.role]}</span>
        </span>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
