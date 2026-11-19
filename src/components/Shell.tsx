import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { loginFor } from "../lib/auth-return";
import { api } from "../lib/supabase";
import { Logo } from "./UI";
export function Header() {
  const { user, theme, setTheme, notify } = useApp(),
    [menu, setMenu] = useState(false),
    [mobile, setMobile] = useState(false),
    location = useLocation(),
    navigate = useNavigate(),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMenu(false);
    setMobile(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    function out(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(false);
        setMobile(false);
      }
    }
    document.addEventListener("click", out);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", out);
      document.removeEventListener("keydown", key);
    };
  }, []);
  function how() {
    setMobile(false);
    setMenu(false);
    if (location.pathname !== "/") navigate("/");
    setTimeout(
      () =>
        document
          .getElementById("workflow")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }
  async function appearance() {
    const t =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(t);
    if (user)
      try {
        await api("profile", "PUT", { theme: t });
      } catch {
        notify("Appearance updated on this device. Cloud sync is unavailable.");
      }
  }
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <div className="dropdown-anchor" ref={ref}>
            <button
              className={"nav-item " + (menu ? "is-active" : "")}
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
            >
              Platform
              <ChevronDown size={13} />
            </button>
            {menu && (
              <div className="dropdown nav-dropdown">
                <span className="menu-label">THE PLATFORM</span>
                <Link to="/verify">
                  <FileCheck2 size={18} />
                  <div>
                    Verify a document<small>Start an evidence review</small>
                  </div>
                </Link>
                <Link to="/report/sample">
                  <FileText size={18} />
                  <div>
                    Sample report<small>Explore a complete review</small>
                  </div>
                </Link>
                <Link to="/methodology">
                  <BookOpen size={18} />
                  <div>
                    Our methodology<small>How evidence is assessed</small>
                  </div>
                </Link>
              </div>
            )}
          </div>
          <button className="nav-item" onClick={how}>
            How it works
          </button>
          <NavLink className="nav-item" to="/library">
            Source library
          </NavLink>
        </nav>
        <div className="header-actions">
          <button
            className="icon-btn theme-toggle"
            onClick={appearance}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={17} />}
          </button>
          <i className="nav-divider" />
          {user ? (
            <Link
              to="/settings"
              className="account-link"
              aria-label="Profile and settings"
            >
              <Settings size={17} />
            </Link>
          ) : (
            <Link to={loginFor(location)} className="login-link">
              Log in
            </Link>
          )}
          <Link className="btn btn-black workspace-button" to="/workspace">
            Workspace
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="icon-btn mobile-toggle"
            aria-expanded={mobile}
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="mobile-menu">
          <Link to="/verify">
            <FileCheck2 size={16} />
            Verify a document
          </Link>
          <button onClick={how}>
            <BookOpen size={16} />
            How it works
          </button>
          <Link to="/library">
            <BookOpen size={16} />
            Source library
          </Link>
          <Link to="/report/sample">
            <FileText size={16} />
            Sample report
          </Link>
          <Link to={user ? "/settings" : loginFor(location)}>
            {user ? "Profile & settings" : "Log in"}
            <ArrowRight size={15} />
          </Link>
        </nav>
      )}
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <div>
          <Logo />
          <p>Scientific claims. Traceable evidence.</p>
        </div>
        <div className="footer-links">
          <Link to="/methodology">Methodology</Link>
          <Link to="/library">Source library</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
        <span className="copyright">© {new Date().getFullYear()} Research</span>
      </div>
    </footer>
  );
}
export function WorkspaceNav() {
  const { user } = useApp();
  return (
    <nav className="workspace-nav">
      <div className="container">
        <NavLink to="/workspace" end>
          <LayoutDashboard size={16} />
          Overview
        </NavLink>
        <NavLink to="/verify">
          <FileCheck2 size={16} />
          New verification
        </NavLink>
        <NavLink to="/saved">
          <BookOpen size={16} />
          Saved claims
        </NavLink>
        {user ? (
          <NavLink to="/settings">
            <Settings size={16} />
            Settings
          </NavLink>
        ) : (
          <NavLink to="/library">
            <BookOpen size={16} />
            Source directory
          </NavLink>
        )}
      </div>
    </nav>
  );
}
export function Toast() {
  const { toast } = useApp();
  return toast ? (
    <div className="toast" role="status">
      <Check size={16} />
      {toast}
    </div>
  ) : null;
}
