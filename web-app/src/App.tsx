import React, { useEffect, useState } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import DocumentProcessor from './DocumentProcessor';
import ExperimentalOCR from './ExperimentalOCR';
import History from './History';
import Settings from './components/Settings';
import AdhocAnalysis from './AdhocAnalysis';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';

interface VersionInfo {
  version: string;
  commit: string;
  buildDate: string;
}

// Inner component so it can access AuthContext
const AppShell: React.FC = () => {
  const { user, loading, setupRequired } = useAuth();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('./api/version');
        if (response.ok) {
          const data = await response.json() as VersionInfo;
          setVersionInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch version information:', error);
      }
    };
    void fetchVersion();
  }, []);

  // Keep the base path and remove the app path.
  const rawBasename = window.location.pathname.replace(/(\/[^/]+)$/, '/');
  const basename = rawBasename === '/' ? '' : rawBasename;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  // First-run: no users exist yet
  if (setupRequired) {
    return <SetupPage />;
  }

  // Not logged in
  if (!user) {
    return <LoginPage />;
  }

  return (
    <Router basename={basename}>
      <div className="flex h-screen flex-col">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar onSelectPage={(page) => console.log(page)} />
          <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<DocumentProcessor />} />
                <Route path="/adhoc-analysis" element={<AdhocAnalysis />} />
                <Route path="/experimental-ocr" element={<ExperimentalOCR />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
            <footer className="border-t border-gray-200 bg-white/90 px-6 py-4 text-center text-sm text-gray-600 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-300">
              <p className="font-medium">
                <span role="img" aria-label="coffee" className="mr-1">☕</span>
                If paperless-gpt saved you time, consider supporting future development.
              </p>
              <a
                href="https://buymeacoffee.com/icereed"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center rounded-md bg-yellow-300 px-4 py-2 text-sm font-semibold text-black no-underline shadow-sm transition hover:bg-yellow-400 hover:shadow dark:bg-yellow-400 dark:hover:bg-yellow-500"
                aria-label="Buy me a coffee to support future development"
              >
                Buy Me a Coffee
              </a>
              {versionInfo && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">paperless-gpt</span> {versionInfo.version}
                  {versionInfo.commit && versionInfo.commit !== 'devCommit' && versionInfo.commit.length >= 7 && (
                    <span className="ml-2">({versionInfo.commit.slice(0, 7)})</span>
                  )}
                </p>
              )}
            </footer>
          </div>
        </div>
      </div>
    </Router>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
