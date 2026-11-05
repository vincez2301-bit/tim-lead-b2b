import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  Ban,
  Building2,
  CalendarCheck,
  Kanban,
  Upload,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Menu,
  Music,
  Radar,
  ScrollText,
  Search,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { DialogHost } from "./dialog";
import { BigfishMark } from "./BigfishMark";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const WORK: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/today", label: "Việc hôm nay", icon: CalendarCheck },
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/search", label: "Tìm kiếm", icon: Search },
  { to: "/companies", label: "Công ty", icon: Building2 },
  { to: "/cohort", label: "Cohort & xuất file", icon: ListFilter },
  { to: "/music", label: "Nhạc mẫu", icon: Music },
];
const ADMIN: NavItem[] = [
  { to: "/import", label: "Nhập dữ liệu", icon: Upload },
  { to: "/signals", label: "Tín hiệu", icon: Radar },
  { to: "/dnc", label: "Loại trừ", icon: Ban },
  { to: "/settings", label: "Cài đặt", icon: Settings },
  { to: "/logs", label: "Nhật ký", icon: ScrollText },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <BigfishMark />
      </span>
      <span>
        Bigfish Lead Finder
        <small>Tìm khách hàng B2B</small>
      </span>
    </div>
  );
}

function Links({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}>
          <Icon aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { profile, session, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const email = profile?.email ?? session?.user.email ?? "";
  return (
    <div className="app">
      <header className="mobilebar">
        <Brand />
        <button type="button" className="btn-icon" aria-expanded={open} aria-controls="sidebar" aria-label="Mở menu" onClick={() => setOpen(true)}>
          <Menu />
        </button>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="sidebar" className={open ? "sidebar open" : "sidebar"}>
        <div className="row space-between nowrap">
          <Brand />
          {open && (
            <button type="button" className="btn-icon" aria-label="Đóng menu" onClick={() => setOpen(false)}>
              <X />
            </button>
          )}
        </div>
        <nav className="nav" aria-label="Điều hướng chính">
          <div className="nav-section">Làm việc</div>
          <Links items={WORK} />
          <div className="nav-section">Quản trị</div>
          <Links items={ADMIN} />
        </nav>
        <div className="userbox">
          <span className="avatar" aria-hidden="true">
            {email.slice(0, 2) || "?"}
          </span>
          <div className="who">
            <strong title={email}>{email}</strong>
            <span>{isAdmin ? "Quản trị viên" : "Thành viên"}</span>
          </div>
          <button type="button" className="btn-icon" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => void signOut()}>
            <LogOut />
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <DialogHost />
    </div>
  );
}
