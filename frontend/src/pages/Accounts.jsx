import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Filter,
  Satellite,
  MapPin,
  Mail,
  Wifi,
  WifiOff,
  Smartphone,
  ChevronRight,
  X,
  Ban,
  CheckCircle,
  Eye,
  EyeOff,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth, API } from "@/App";
import { formatDistanceToNow } from "date-fns";

export default function Accounts() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    account_name: "",
    location: "",
    account_email: "",
    kit_number: "",
    notes: "",
    billing_day: 1,
    monthly_amount: 0,
    account_password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, accountStatusFilter]);

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (accountStatusFilter !== "all") params.append("account_status", accountStatusFilter);

      const response = await fetch(`${API}/accounts?${params}`, {
        credentials: "include",
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${API}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Account created successfully");
        setShowAddModal(false);
        setFormData({
          account_name: "",
          location: "",
          account_email: "",
          kit_number: "",
          notes: "",
          billing_day: 1,
          monthly_amount: 0,
        });
        fetchAccounts();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create account");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="accounts-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Starlink Accounts</h1>
            <p className="text-muted-foreground mt-1">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="btn-hover" data-testid="add-account-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg" data-testid="add-account-modal">
              <DialogHeader>
                <DialogTitle>Add New Starlink Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label className="form-label">Account Name *</Label>
                    <Input
                      value={formData.account_name}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      placeholder="e.g., Main Office"
                      required
                      data-testid="account-name-input"
                    />
                  </div>
                  <div className="form-group">
                    <Label className="form-label">Location *</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., New York, NY"
                      required
                      data-testid="location-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label className="form-label">Account Email *</Label>
                    <Input
                      type="email"
                      value={formData.account_email}
                      onChange={(e) => setFormData({ ...formData, account_email: e.target.value })}
                      placeholder="starlink@example.com"
                      required
                      data-testid="account-email-input"
                    />
                  </div>
                  <div className="form-group">
                    <Label className="form-label">Kit Number *</Label>
                    <Input
                      value={formData.kit_number}
                      onChange={(e) => setFormData({ ...formData, kit_number: e.target.value })}
                      placeholder="e.g., UT-XXXXX-XXXXX"
                      required
                      data-testid="kit-number-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <Label className="form-label flex items-center gap-2">
                    <Key className="w-4 h-4" /> Account Password (Optional)
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.account_password}
                      onChange={(e) => setFormData({ ...formData, account_password: e.target.value })}
                      placeholder="Starlink account password (stored encrypted)"
                      data-testid="account-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Password is encrypted and can only be viewed after re-authentication
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label className="form-label">Billing Day (1-31)</Label>
                    <Select
                      value={String(formData.billing_day)}
                      onValueChange={(value) => setFormData({ ...formData, billing_day: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="billing-day-select">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(31)].map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            Day {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      For months with fewer days, billing moves to last day
                    </p>
                  </div>
                  <div className="form-group">
                    <Label className="form-label">Monthly Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_amount}
                      onChange={(e) => setFormData({ ...formData, monthly_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="120.00"
                      data-testid="monthly-amount-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <Label className="form-label">Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this account..."
                    rows={3}
                    data-testid="notes-input"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} data-testid="submit-account-btn">
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Add Account"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="status-filter">
              <Wifi className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Connection</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accountStatusFilter} onValueChange={setAccountStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="account-status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Accounts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="account-card">
                <div className="skeleton h-6 w-3/4 mb-3"></div>
                <div className="skeleton h-4 w-1/2 mb-2"></div>
                <div className="skeleton h-4 w-2/3"></div>
              </div>
            ))}
          </div>
        ) : accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {accounts.map((account, index) => (
              <div
                key={account.account_id}
                className={`account-card animate-fade-in ${account.status === 'cancelled' ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/accounts/${account.account_id}`)}
                data-testid={`account-card-${index}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
                      <Satellite className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{account.account_name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {account.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={account.is_online ? 'badge-online' : 'badge-offline'}>
                      {account.is_online ? (
                        <><Wifi className="w-3 h-3 mr-1" /> Online</>
                      ) : (
                        <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                      )}
                    </Badge>
                    {account.status !== 'active' && (
                      <Badge className={account.status === 'cancelled' ? 'badge-offline' : 'badge-medium'}>
                        {account.status === 'cancelled' ? (
                          <><Ban className="w-3 h-3 mr-1" /> Cancelled</>
                        ) : (
                          <><Ban className="w-3 h-3 mr-1" /> Inactive</>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{account.account_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Smartphone className="w-4 h-4" />
                    <span>{account.devices_connected} device{account.devices_connected !== 1 ? 's' : ''} connected</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    Kit: <span className="data-value">{account.kit_number}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state py-16">
            <Satellite className="empty-state-icon" />
            <p className="empty-state-title">No accounts found</p>
            <p className="empty-state-description">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter"
                : "Add your first Starlink account to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button className="mt-4" onClick={() => setShowAddModal(true)} data-testid="empty-add-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
