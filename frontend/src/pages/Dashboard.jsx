import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Satellite, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CreditCard, 
  Smartphone,
  ArrowRight,
  Plus,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API } from "@/App";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard({ auth }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/dashboard/stats`, {
        credentials: "include",
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-8 w-16 mb-2"></div>
              <div className="skeleton h-4 w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {auth.user?.name?.split(' ')[0]}
            </p>
          </div>
          <Button 
            onClick={() => navigate('/accounts')} 
            className="btn-hover hidden sm:flex"
            data-testid="add-account-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="stat-card animate-fade-in stagger-1" data-testid="stat-total-accounts">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-value text-foreground">{stats?.total_accounts || 0}</p>
                  <p className="stat-label">Total Accounts</p>
                </div>
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Satellite className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card animate-fade-in stagger-2" data-testid="stat-online">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-value text-green-400">{stats?.online_accounts || 0}</p>
                  <p className="stat-label">Online</p>
                </div>
                <div className="w-10 h-10 rounded-sm bg-green-500/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card animate-fade-in stagger-3" data-testid="stat-offline">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-value text-red-400">{stats?.offline_accounts || 0}</p>
                  <p className="stat-label">Offline</p>
                </div>
                <div className="w-10 h-10 rounded-sm bg-red-500/10 flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card animate-fade-in stagger-4" data-testid="stat-tickets">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-value text-yellow-400">{stats?.open_tickets || 0}</p>
                  <p className="stat-label">Open Tickets</p>
                </div>
                <div className="w-10 h-10 rounded-sm bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
          <Card className="stat-card" data-testid="stat-devices">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-sm bg-blue-500/10 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="stat-value text-2xl">{stats?.total_devices || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Devices Connected</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-sm bg-purple-500/10 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="stat-value text-2xl">{stats?.upcoming_payments?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Payments Due (7 days)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Payments & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Payments */}
          <Card className="bg-card border-border/40" data-testid="upcoming-payments">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Upcoming Payments
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.upcoming_payments?.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcoming_payments.slice(0, 5).map((payment, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm border border-border/30 hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/accounts/${payment.account_id}`)}
                      data-testid={`payment-item-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${payment.days_until <= 2 ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <div>
                          <p className="font-medium text-sm">{payment.account_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Due in {payment.days_until} day{payment.days_until !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="data-value text-primary">${payment.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">
                  <CreditCard className="empty-state-icon" />
                  <p className="empty-state-title">No upcoming payments</p>
                  <p className="empty-state-description">All payments are up to date</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card className="bg-card border-border/40" data-testid="recent-payments">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Recent Payments
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recent_payments?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_payments.map((payment, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm border border-border/30"
                      data-testid={`recent-payment-${index}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{payment.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.payment_date), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="badge-online">
                        ${payment.amount.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">
                  <CreditCard className="empty-state-icon" />
                  <p className="empty-state-title">No recent payments</p>
                  <p className="empty-state-description">Payment history will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Mobile */}
        <div className="sm:hidden">
          <Button 
            onClick={() => navigate('/accounts')} 
            className="w-full btn-hover"
            data-testid="mobile-add-account-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Account
          </Button>
        </div>
      </div>
    </div>
  );
}
