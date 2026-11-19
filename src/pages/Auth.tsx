import {
  ArrowRight,
  BookOpen,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorBox, Kicker, Mark } from "../components/UI";
import { useApp } from "../contexts/AppContext";
import { afterLogin } from "../lib/auth-return";
import supabase, { googleSignIn, offlineDemo } from "../lib/supabase";
import { errorText } from "../lib/types";
export default function Auth() {
  const { user } = useApp(),
    nav = useNavigate(),
    [params] = useSearchParams(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [isSignUp, setIsSignUp] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState("");
  const next = afterLogin(params.get("next"));
  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, next, nav]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = isSignUp
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (isSignUp && !data.session) {
        setIsSignUp(false);
        setPassword("");
        setNotice(
          "If your account needs email confirmation, follow the link in your inbox, then sign in with your password.",
        );
      }
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setErr("");
    try {
      await googleSignIn();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <Kicker>PRIVATE RESEARCH WORKSPACE</Kicker>
          <h2>
            Good research
            <br />
            starts with
            <br />
            <em>evidence.</em>
          </h2>
          <div className="auth-brain">
            <img
              src="/images/brain-engraving.webp"
              alt="Scientific brain engraving"
            />
          </div>
          <span className="mono-label">FIG. 01 / NEUROSCIENCE</span>
          <div className="auth-privacy">
            <ShieldCheck size={17} />
            Your documents stay in your workspace.
          </div>
        </aside>
        <div className="auth-form-wrap">
          <span className="auth-mark">
            <Mark size={28} />
          </span>
          <h1>{isSignUp ? "Create your account." : "Welcome to Research."}</h1>
          <p>
            {isSignUp
              ? "Create a research workspace with your email address and a password."
              : "Sign in to verify documents, save evidence, and access your research from any device."}
          </p>
          {offlineDemo ? (
            <div className="info-box">
              <ShieldCheck size={16} />
              <span>
                <b>Offline demonstration mode.</b> Account creation and Google
                sign-in need the project&apos;s cloud configuration. You can still
                upload a public document and explore a demonstration report as a guest.
              </span>
              <Link className="btn btn-primary full" to="/verify">
                Open guest verification
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              {err && <ErrorBox text={err} />}
              <div aria-live="polite" className={notice ? "info-box" : "hidden"}>
                {notice}
              </div>
              <button
            className="btn btn-white full"
            onClick={google}
            disabled={busy}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285f4"
                d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.6 4.6 0 0 1-2.1 3v2.7h3.4c2-1.9 3-4.5 3-7.6Z"
              />
              <path
                fill="#34a853"
                d="M12 22c2.7 0 5-.9 6.7-2.4L15.3 17c-.9.6-2 .9-3.3.9-2.7 0-5-1.8-5.8-4.2H2.7v2.7A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#fbbc05"
                d="M6.2 13.7a6 6 0 0 1 0-3.4V7.6H2.7a10 10 0 0 0 0 8.8Z"
              />
              <path
                fill="#ea4335"
                d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.3 5.6l3.5 2.7A6 6 0 0 1 12 6.1Z"
              />
            </svg>
            Continue with Google
              </button>
              <div className="form-or">
            <i />
            or use email and password
            <i />
              </div>
              <form onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">
              Email address
            </label>
            <input
              id="auth-email"
              className="field"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
            />
            <label className="field-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="field"
              type="password"
              required
              minLength={isSignUp ? 8 : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            />
            <button className="btn btn-primary full" disabled={busy}>
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <KeyRound size={16} />
              )}{" "}
              {isSignUp ? "Create account" : "Sign in"}
              <ArrowRight size={15} />
            </button>
              </form>
              <button
            className="auth-switch"
            disabled={busy}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setPassword("");
              setErr("");
              setNotice("");
            }}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "New to Research? Create an account"}
              </button>
              <div className="auth-bottom">
            <BookOpen size={15} />
            <Link to="/report/sample">
              Explore a sample report without signing in
              <ArrowUpRightIcon />
            </Link>
              </div>
              <Link
            className="text-link guest-access"
            to={next === "/settings" ? "/workspace" : next}
            replace
          >
            Continue as a guest
            <ArrowRight size={14} />
              </Link>
              <p className="fine-print">
            <LockKeyhole size={12} />
            By continuing, you agree to our{" "}
            <Link to="/privacy">privacy notice</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={13} />;
}
