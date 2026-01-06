import { useEffect, useState, useRef, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Settings from "./pages/Settings";
import Layout from "./components/Layout";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const checkAuth = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API}/auth/me`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setToken(currentToken);
      } else {
        setUser(null);
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
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
    const currentToken = localStorage.getItem('token');
    try {
      await fetch(`${API}/auth/logout`, { 
        method: 'POST', 
        credentials: 'include',
        headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}
      });
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('token');
    setToken(null);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = { user, loading, login, logout, checkAuth, token };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component for Google OAuth
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const auth = useAuth();
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
            auth.login(userData);
            // Clear hash and navigate to dashboard
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/dashboard', { replace: true });
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
  }, [navigate, auth]);

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
const ProtectedRoute = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

// App Router Component
const AppRouter = () => {
  const location = useLocation();
  const auth = useAuth();

  // Check for session_id in URL hash - process OAuth callback
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={
        auth.user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/register" element={
        auth.user ? <Navigate to="/dashboard" replace /> : <Register />
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/accounts/:accountId" element={
        <ProtectedRoute>
          <AccountDetail />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <div className="noise-overlay" aria-hidden="true"></div>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
