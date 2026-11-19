import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  HelpCircle,
  Loader2,
  Minus,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { loginFor } from "../lib/auth-return";
import type { Verdict } from "../lib/types";
export function Mark({ size = 31 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 10.2 11.4 6v20L4 30.2z" fill="currentColor" />
      <path d="m14.3 6.6 7.3-4.2v20l-7.3 4.2z" fill="currentColor" />
      <path d="m24.5 8.4 7.3-4.2v20l-7.3 4.2z" fill="currentColor" />
    </svg>
  );
}
export function Logo() {
  return (
    <Link to="/" className="brand" aria-label="Research home">
      <Mark />
      <span>
        Research<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export function Spinner({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 size={21} className="spin" />
      {text}
    </div>
  );
}
export function ErrorBox({
  text,
  retry,
}: {
  text: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={17} />
      <span>{text}</span>
      {retry && (
        <button className="text-link" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Badge({ status }: { status: Verdict }) {
  const I =
    status === "Supported"
      ? CheckCheck
      : status === "Partially Supported"
        ? Minus
        : status === "Possibly Outdated"
          ? Clock3
          : status === "Contradictory"
            ? XCircle
            : status === "Unsupported"
              ? X
              : HelpCircle;
  return (
    <span className={"verdict v-" + status.toLowerCase().replaceAll(" ", "-")}>
      <I size={13} />
      {status}
    </span>
  );
}
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="kicker">
      <span />
      {children}
    </div>
  );
}
export function Empty({
  icon,
  heading,
  children,
  to,
  label,
}: {
  icon: ReactNode;
  heading: string;
  children: ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{heading}</h3>
      <p>{children}</p>
      {to && (
        <Link className="btn btn-primary" to={to}>
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const els = box.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === box.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useApp(),
    loc = useLocation();
  if (loading) return <Spinner text="Opening your workspace…" />;
  return user ? (
    <>{children}</>
  ) : (
    <Navigate replace to={loginFor(loc)} />
  );
}
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <div className="check-line">
      <Check size={16} />
      {children}
    </div>
  );
}
