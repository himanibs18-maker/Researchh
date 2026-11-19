import {
  Check,
  Database,
  LogOut,
  Monitor,
  Moon,
  Save,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { WorkspaceNav } from "../components/Shell";
import { ErrorBox, Kicker, Spinner } from "../components/UI";
import { useApp } from "../contexts/AppContext";
import supabase, { api } from "../lib/supabase";
import { errorText, type Format, type Theme } from "../lib/types";
export default function Settings() {
  const { user, profile, refreshProfile, notify } = useApp(),
    [name, setName] = useState(""),
    [institution, setInstitution] = useState(""),
    [theme, setTheme] = useState<Theme>("light"),
    [format, setFormat] = useState<Format>("PDF"),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    nav = useNavigate();
  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setInstitution(profile.institution);
      setTheme(profile.theme);
      setFormat(profile.report_format);
    } else void refreshProfile().catch((e) => setErr(errorText(e)));
  }, [profile, refreshProfile]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("profile", "PUT", {
        display_name: name,
        institution,
        theme,
        report_format: format,
      });
      await refreshProfile();
      notify("Profile and preferences saved");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErr(error.message);
      return;
    }
    nav("/");
    notify("Signed out securely");
  }
  return (
    <>
      <WorkspaceNav />
      <main className="container page-main settings-page">
        <Kicker>ACCOUNT PREFERENCES</Kicker>
        <h1 className="page-title">Profile & settings.</h1>
        <p className="page-subtitle">
          A workspace that fits the way you research.
        </p>
        {err && <ErrorBox text={err} retry={refreshProfile} />}{" "}
        {!profile && !err ? (
          <Spinner text="Loading your preferences…" />
        ) : (
          <form onSubmit={save}>
            <div className="settings-panel">
              <div className="settings-title">
                <UserRound size={19} />
                <h2>Researcher profile</h2>
              </div>
              <div className="form-grid">
                <label>
                  Display name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={70}
                    className="field"
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Institution
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    maxLength={120}
                    className="field"
                    placeholder="University or organization"
                  />
                </label>
              </div>
              <label>
                Verified email
                <input className="field" value={user?.email || ""} readOnly />
              </label>
            </div>
            <div className="settings-panel">
              <h2>Workspace preferences</h2>
              <label>Appearance</label>
              <div className="theme-options">
                {(["light", "dark", "system"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={theme === t ? "selected" : ""}
                    onClick={() => setTheme(t)}
                  >
                    {t === "light" ? (
                      <Sun size={16} />
                    ) : t === "dark" ? (
                      <Moon size={16} />
                    ) : (
                      <Monitor size={16} />
                    )}{" "}
                    {t}
                    {theme === t && <Check size={13} />}
                  </button>
                ))}
              </div>
              <label>
                Default report format
                <select
                  className="field"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                >
                  {["PDF", "DOCX", "Excel", "CSV"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="settings-panel">
              <div className="settings-title">
                <Database size={18} />
                <h2>Verification services</h2>
              </div>
              <p className="muted">
                Scholarly retrieval uses Crossref, OpenAlex and Semantic
                Scholar. Provider availability is recorded in each report.
              </p>
              <div className="engine-status">
                <span className="tiny-dot" />
                {profile?.ai_available
                  ? "Gemini evidence assessment enabled"
                  : "Source-grounded matching enabled"}
              </div>
              {!profile?.ai_available && (
                <p className="fine-print">
                  Gemini is not configured for this deployment. No AI verdicts
                  or confidence scores are invented.
                </p>
              )}
            </div>
            <div className="button-row">
              <button className="btn btn-primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn btn-white" onClick={logout}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
