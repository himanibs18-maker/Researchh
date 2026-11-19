import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { Footer, Header, Toast } from "./components/Shell";
import { Protected } from "./components/UI";
import { AppProvider } from "./contexts/AppContext";
import Auth from "./pages/Auth";
import Info from "./pages/Info";
import Landing from "./pages/Landing";
import Library from "./pages/Library";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Verify from "./pages/Verify";
import Workspace, { SavedClaims } from "./pages/Workspace";
export default function ResearchApp() {
  return (
    <AppProvider>
      <HashRouter>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          Skip to content
        </a>
        <Header />
        <div id="main-content" tabIndex={-1} className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/library" element={<Library />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/saved" element={<SavedClaims />} />
            <Route
              path="/settings"
              element={
                <Protected>
                  <Settings />
                </Protected>
              }
            />
            <Route path="/methodology" element={<Info />} />
            <Route path="/privacy" element={<Info privacy />} />
            <Route
              path="*"
              element={
                <div className="container page-main">
                  <h1 className="page-title">Page not found.</h1>
                  <p className="page-subtitle">
                    This page is not in the research library.
                  </p>
                  <Link to="/" className="btn btn-primary">
                    Back to Research
                  </Link>
                </div>
              }
            />
          </Routes>
        </div>
        <Footer />
        <Toast />
      </HashRouter>
    </AppProvider>
  );
}
