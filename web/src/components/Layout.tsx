import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  Building2,
  CalendarCheck,
  Download,
  Kanban,
  LogOut,
  Mail,
  Menu,
  MessageSquareWarning,
  Music,
  Search,
  Settings,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { SettingsProvider } from "../lib/settings";
import { DialogHost } from "./dialog";
import { PlayerProvider } from "./Player";
import { BigfishMark } from "./BigfishMark";
import { Spinner } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Menu theo thứ tự công việc: bán hàng mỗi ngày → nội dung để gửi → tìm khách mới → hệ thống. */
const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Bán hàng",
    items: [
      { to: "/", label: "Hôm nay", icon: CalendarCheck, end: true },
      { to: "/pipeline", label: "Pipeline", icon: Kanban },
    ],
  },
  {
    title: "Kho nội dung",
    items: [
      { to: "/library/emails", label: "Email & tin nhắn mẫu", icon: Mail },
      { to: "/library/objections", label: "Xử lý từ chối", icon: MessageSquareWarning },
      { to: "/music", label: "Nhạc mẫu", icon: Music },
    ],
  },
  {
    title: "Tìm khách",
    items: [
      { to: "/search", label: "Tìm khách mới", icon: Search },
      { to: "/companies", label: "Công ty", icon: Building2 },
      { to: "/import", label: "Nhập file", icon: Upload },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/cohort", label: "Xuất danh sách", icon: Download },
      { to: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <BigfishMark />
      </span>
      <span>
        Bigfish Lead Finder
        <small>Epidemic Sound · TP.HCM</small>
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
    <SettingsProvider>
    <PlayerProvider>
      <div className="app">
        <header className="mobilebar">
          <Brand />
          <button
            type="button"
            className="btn-icon"
            aria-expanded={open}
            aria-controls="sidebar"
            aria-label="Mở menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
        </header>
        {open && (
          <div
            className="scrim"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside id="sidebar" className={open ? "sidebar open" : "sidebar"}>
          <div className="row space-between nowrap">
            <Brand />
            {open && (
              <button
                type="button"
                className="btn-icon"
                aria-label="Đóng menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            )}
          </div>
          <nav className="nav" aria-label="Điều hướng chính">
            {NAV.map((g) => (
              <div key={g.title} className="nav-group">
                <div className="nav-section">{g.title}</div>
                <Links items={g.items} />
              </div>
            ))}
          </nav>
          <div className="userbox">
            <span className="avatar" aria-hidden="true">
              {email.slice(0, 2) || "?"}
            </span>
            <div className="who">
              <strong title={email}>{email}</strong>
              <span>{isAdmin ? "Quản trị viên" : "Thành viên"}</span>
            </div>
            <button
              type="button"
              className="btn-icon"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              onClick={() => void signOut()}
            >
              <LogOut />
            </button>
          </div>
        </aside>
        <main className="content">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
        <DialogHost />
      </div>
    </PlayerProvider>
    </SettingsProvider>
  );
}
