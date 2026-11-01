import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../lib/auth";

const NAV = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/search", label: "Tìm kiếm" },
  { to: "/companies", label: "Công ty" },
  { to: "/cohort", label: "Cohort" },
  { to: "/signals", label: "Tín hiệu" },
  { to: "/dnc", label: "Loại trừ" },
  { to: "/settings", label: "Cài đặt" },
  { to: "/logs", label: "Nhật ký" },
];

export function Layout() {
  const { profile, session, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Sync Lead Finder</div>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <nav id="main-nav" className={open ? "nav open" : "nav"}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <span className="muted small">
            {profile?.email ?? session?.user.email} · {isAdmin ? "admin" : "user"}
          </span>
          <button type="button" className="btn-link" onClick={() => void signOut()}>
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
