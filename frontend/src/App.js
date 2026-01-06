import { useEffect, useState, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AccountDetail from "@/pages/AccountDetail";
import Settings from "@/pages/Settings";
import Layout from "@/components/Layout";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth context
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API}/auth/me`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, jwtToken) => {
    setUser(userData);
    if (jwtToken) {
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { 
        method: 'POST', 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('token');
    setToken(null);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return { user, loading, login, logout, checkAuth, token };
};

// Auth Callback Component for Google OAuth
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = window.location.hash;
      const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
      
      if (sessionId) {
        try {
          const response = await fetch(`${API}/auth/session`, {
            headers: { 'X-Session-ID': sessionId },
            credentials: 'include'
          });
          
          if (response.ok) {
            const userData = await response.json();
            // Clear hash and navigate to dashboard with user data
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/dashboard', { state: { user: userData }, replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        } catch (error) {
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, auth }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [localUser, setLocalUser] = useState(location.state?.user || null);

  useEffect(() => {
    // If user data passed from AuthCallback, use it and update auth context
    if (location.state?.user) {
      auth.login(location.state.user);
      setIsAuthenticated(true);
      setLocalUser(location.state.user);
      // Clear location state
      window.history.replaceState({}, document.title);
      return;
    }

    // Otherwise check auth
    if (auth.loading) return;
    
    if (auth.user) {
      setIsAuthenticated(true);
      setLocalUser(auth.user);
    } else {
      setIsAuthenticated(false);
    }
  }, [auth.loading, auth.user, location.state]);

  if (isAuthenticated === null || auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// App Router Component
const AppRouter = ({ auth }) => {
  const location = useLocation();

  // Check for session_id in URL hash - process OAuth callback
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={
        auth.user ? <Navigate to="/dashboard" replace /> : <Login auth={auth} />
      } />
      <Route path="/register" element={
        auth.user ? <Navigate to="/dashboard" replace /> : <Register auth={auth} />
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute auth={auth}>
          <Layout auth={auth}>
            <Dashboard auth={auth} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute auth={auth}>
          <Layout auth={auth}>
            <Accounts auth={auth} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/accounts/:accountId" element={
        <ProtectedRoute auth={auth}>
          <Layout auth={auth}>
            <AccountDetail auth={auth} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute auth={auth}>
          <Layout auth={auth}>
            <Settings auth={auth} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  const auth = useAuth();

  return (
    <div className="App">
      <div className="noise-overlay" aria-hidden="true"></div>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <AppRouter auth={auth} />
      </BrowserRouter>
    </div>
  );
}

export default App;
