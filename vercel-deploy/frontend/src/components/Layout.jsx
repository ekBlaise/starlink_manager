import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { 
  LayoutDashboard, 
  Satellite, 
  Settings, 
  LogOut,
  Menu,
  X,
  Zap
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import NotificationBell from "./NotificationBell";

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await auth.logout();
    navigate('/login');
  };

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/accounts", icon: Satellite, label: "Accounts" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden lg:block" data-testid="desktop-sidebar">
        <div className="p-6 border-b border-border/50 navbar-gradient">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">StarOps Konexa</h1>
              <p className="text-xs text-cyan-200/70">Connectivity Alive</p>
            </div>
          </div>
        </div>
        
        <nav className="p-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary/50 transition-colors" data-testid="user-menu-trigger">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={auth.user?.picture} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs">
                    {getInitials(auth.user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{auth.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{auth.user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="menu-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="menu-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 navbar-gradient px-4 py-3" data-testid="mobile-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">StarOps Konexa</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:bg-white/10"
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="mt-4 pb-4 border-t border-white/10 pt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive ? 'text-cyan-300 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-red-400 w-full mt-2 hover:bg-white/5 rounded-lg"
              data-testid="mobile-logout"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </nav>
        )}
      </header>

      {/* Desktop Header with Notifications */}
      <div className="hidden lg:flex fixed top-0 left-64 right-0 h-16 items-center justify-end px-8 z-40 navbar-gradient border-b border-white/10">
        <NotificationBell />
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen" data-testid="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
