import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronDown, Compass, LogOut, Menu, Settings, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

function Brand() {
  return <Link href="/" className="brand-mark" aria-label="SkillSwap home"><span className="brand-symbol"><span /><span /></span><span>Skill<span className="brand-accent">Swap</span></span></Link>;
}

function Avatar({ user, small = false }) {
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "SS";
  return user?.avatar ? <img className={small ? "app-avatar app-avatar-small" : "app-avatar"} src={user.avatar} alt={user.name} /> : <span className={small ? "app-avatar app-avatar-small app-avatar-fallback" : "app-avatar app-avatar-fallback"}>{initials}</span>;
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const closeOnOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  const go = (path) => { setOpen(false); navigate(path); };
  return <div className="profile-menu-wrap" ref={menuRef}>
    <button type="button" className="profile-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Avatar user={user} small /><span className="profile-trigger-name">{user.name}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
    {open && <div className="profile-menu" role="menu">
      <div className="profile-menu-head"><Avatar user={user} /><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
      <div className="profile-menu-divider" />
      <button type="button" role="menuitem" onClick={() => go("/profile")}><UserRound /> Profile</button>
      <button type="button" role="menuitem" onClick={() => go("/settings")}><Settings /> Account settings</button>
      <button type="button" role="menuitem" onClick={() => go("/notifications")}><Bell /> Notifications</button>
      <div className="profile-menu-divider" />
      <button type="button" role="menuitem" className="profile-menu-danger" onClick={onLogout}><LogOut /> Sign out</button>
    </div>}
  </div>;
}

export function AppShell({ children, pageLabel = "Workspace" }) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signOut = async () => { await logout(); setMobileOpen(false); navigate("/"); };
  return <div className="app-shell"><header className="app-nav"><div className="shell app-nav-inner"><Brand /><nav className={mobileOpen ? "app-nav-links is-open" : "app-nav-links"} aria-label="Application navigation"><Link href="/" onClick={() => setMobileOpen(false)}>Home</Link><Link href="/matches" onClick={() => setMobileOpen(false)}>Matches</Link><Link href="/requests" onClick={() => setMobileOpen(false)}>Requests</Link><Link href="/browse" onClick={() => setMobileOpen(false)}>Browse</Link></nav><div className="app-nav-actions">{user && <><span className="app-nav-label">{pageLabel}</span><ProfileMenu user={user} onLogout={signOut} /></>}</div><button type="button" className="app-mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X /> : <Menu />}</button></div></header><main className="app-main">{children}</main><footer className="app-footer"><div className="shell app-footer-inner"><span><Sparkles className="h-4 w-4 text-cyan-300" /> SkillSwap</span><small>Learn together. Grow together.</small></div></footer></div>;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user, navigate]);
  if (loading) return <div className="route-loading"><div className="loading-orb" /><p>Checking your session...</p></div>;
  return user ? children : null;
}
