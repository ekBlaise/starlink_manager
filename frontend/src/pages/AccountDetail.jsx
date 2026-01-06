import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Satellite, 
  MapPin, 
  Mail, 
  Wifi, 
  WifiOff,
  Smartphone,
  Router,
  CreditCard,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  Clock,
  Check,
  Ban,
  CheckCircle,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth, API } from "@/App";
import { format, formatDistanceToNow } from "date-fns";

export default function AccountDetail() {
  const auth = useAuth();
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // Related data
  const [billingRecords, setBillingRecords] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [extenders, setExtenders] = useState([]);
  const [devices, setDevices] = useState([]);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showExtenderModal, setShowExtenderModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Form states
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: "manual", notes: "", is_paid: true });
  const [ticketForm, setTicketForm] = useState({ title: "", description: "", priority: "medium" });
  const [extenderForm, setExtenderForm] = useState({ name: "", ip_address: "", location: "" });
  const [deviceForm, setDeviceForm] = useState({ name: "", mac_address: "", device_type: "unknown", extender_id: "main_router" });

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  useEffect(() => {
    fetchAccount();
    fetchBillingRecords();
    fetchTickets();
    fetchExtenders();
    fetchDevices();
  }, [accountId]);

  const fetchAccount = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}`, {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setAccount(data);
        setEditData(data);
      } else {
        navigate('/accounts');
      }
    } catch (error) {
      console.error("Failed to fetch account:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingRecords = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}/billing`, { credentials: "include", headers });
      if (response.ok) setBillingRecords(await response.json());
    } catch (error) {}
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}/tickets`, { credentials: "include", headers });
      if (response.ok) setTickets(await response.json());
    } catch (error) {}
  };

  const fetchExtenders = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}/extenders`, { credentials: "include", headers });
      if (response.ok) setExtenders(await response.json());
    } catch (error) {}
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}/devices`, { credentials: "include", headers });
      if (response.ok) setDevices(await response.json());
    } catch (error) {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API}/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        const data = await response.json();
        setAccount(data);
        setEditing(false);
        toast.success("Account updated");
      } else {
        toast.error("Failed to update");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`${API}/accounts/${accountId}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      if (response.ok) {
        toast.success("Account deleted");
        navigate('/accounts');
      }
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/accounts/${accountId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ ...paymentForm, payment_date: new Date(paymentForm.payment_date).toISOString() }),
      });
      if (response.ok) {
        toast.success("Payment recorded");
        setShowPaymentModal(false);
        setPaymentForm({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: "manual", notes: "", is_paid: true });
        fetchBillingRecords();
      }
    } catch (error) {
      toast.error("Failed to add payment");
    }
  };

  const togglePaymentStatus = async (billingId, currentStatus) => {
    try {
      await fetch(`${API}/accounts/${accountId}/billing/${billingId}?is_paid=${!currentStatus}`, {
        method: "PUT",
        credentials: "include",
        headers,
      });
      fetchBillingRecords();
      toast.success(currentStatus ? "Marked as unpaid" : "Marked as paid");
    } catch (error) {
      toast.error("Failed to update payment status");
    }
  };

  const addTicket = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/accounts/${accountId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify(ticketForm),
      });
      if (response.ok) {
        toast.success("Ticket created");
        setShowTicketModal(false);
        setTicketForm({ title: "", description: "", priority: "medium" });
        fetchTickets();
      }
    } catch (error) {
      toast.error("Failed to create ticket");
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await fetch(`${API}/accounts/${accountId}/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      fetchTickets();
      toast.success(`Ticket ${status}`);
    } catch (error) {}
  };

  const addExtender = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/accounts/${accountId}/extenders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify(extenderForm),
      });
      if (response.ok) {
        toast.success("Extender added");
        setShowExtenderModal(false);
        setExtenderForm({ name: "", ip_address: "", location: "" });
        fetchExtenders();
      }
    } catch (error) {
      toast.error("Failed to add extender");
    }
  };

  const addDevice = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/accounts/${accountId}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ ...deviceForm, extender_id: deviceForm.extender_id === "main_router" ? null : deviceForm.extender_id }),
      });
      if (response.ok) {
        toast.success("Device added");
        setShowDeviceModal(false);
        setDeviceForm({ name: "", mac_address: "", device_type: "unknown", extender_id: "main_router" });
        fetchDevices();
        fetchAccount();
      }
    } catch (error) {
      toast.error("Failed to add device");
    }
  };

  const toggleDeviceWhitelist = async (deviceId, isWhitelisted) => {
    try {
      await fetch(`${API}/accounts/${accountId}/devices/${deviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ is_whitelisted: !isWhitelisted }),
      });
      fetchDevices();
      toast.success(isWhitelisted ? "Device blocked" : "Device whitelisted");
    } catch (error) {}
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="skeleton h-8 w-48 mb-6"></div>
        <div className="skeleton h-64 w-full"></div>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div data-testid="account-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{account.account_name}</h1>
              <Badge className={account.is_online ? 'badge-online' : 'badge-offline'}>
                {account.is_online ? <><Wifi className="w-3 h-3 mr-1" /> Online</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
              </Badge>
              {account.status !== 'active' && (
                <Badge className={account.status === 'cancelled' ? 'badge-offline' : 'badge-medium'}>
                  {account.status === 'cancelled' ? <><Ban className="w-3 h-3 mr-1" /> Cancelled</> : <><Ban className="w-3 h-3 mr-1" /> Inactive</>}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              {account.location}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="ghost" onClick={() => { setEditing(false); setEditData(account); }} data-testid="cancel-edit-btn">
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} data-testid="save-btn">
                  <Save className="w-4 h-4 mr-2" /> Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)} data-testid="edit-btn">
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="delete-btn">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this account and all related data including billing records, tickets, extenders, and devices.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {/* Account Info Card */}
        <Card className="bg-card border-border/40 mb-6" data-testid="account-info-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Account Email</Label>
                {editing ? (
                  <Input value={editData.account_email} onChange={(e) => setEditData({ ...editData, account_email: e.target.value })} className="mt-1" />
                ) : (
                  <p className="font-medium mt-1 flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {account.account_email}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Kit Number</Label>
                {editing ? (
                  <Input value={editData.kit_number} onChange={(e) => setEditData({ ...editData, kit_number: e.target.value })} className="mt-1" />
                ) : (
                  <p className="data-value mt-1">{account.kit_number}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Monthly Amount</Label>
                {editing ? (
                  <Input type="number" step="0.01" value={editData.monthly_amount} onChange={(e) => setEditData({ ...editData, monthly_amount: parseFloat(e.target.value) || 0 })} className="mt-1" />
                ) : (
                  <p className="data-value mt-1 text-primary">${account.monthly_amount?.toFixed(2)}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Billing Day (1-31)</Label>
                {editing ? (
                  <Select value={String(editData.billing_day)} onValueChange={(v) => setEditData({ ...editData, billing_day: parseInt(v) })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...Array(31)].map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium mt-1">Day {account.billing_day}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Subscription Status</Label>
                {editing ? (
                  <Select value={editData.status || "active"} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active"><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" /> Active</SelectItem>
                      <SelectItem value="inactive"><Ban className="w-3 h-3 inline mr-1 text-yellow-500" /> Inactive</SelectItem>
                      <SelectItem value="cancelled"><Ban className="w-3 h-3 inline mr-1 text-red-500" /> Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium mt-1 flex items-center gap-1">
                    {account.status === 'active' ? (
                      <><CheckCircle className="w-4 h-4 text-green-500" /> Active</>
                    ) : account.status === 'cancelled' ? (
                      <><Ban className="w-4 h-4 text-red-500" /> Cancelled</>
                    ) : (
                      <><Ban className="w-4 h-4 text-yellow-500" /> Inactive</>
                    )}
                  </p>
                )}
              </div>
            </div>
            {(account.notes || editing) && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Notes</Label>
                {editing ? (
                  <Textarea value={editData.notes || ""} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} className="mt-1" rows={3} />
                ) : (
                  <p className="text-sm mt-1 text-muted-foreground">{account.notes || "No notes"}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connectivity Status */}
        <Card className="bg-card border-border/40 mb-6" data-testid="connectivity-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Satellite className="w-5 h-5 text-primary" />
              Connectivity Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-secondary/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`status-dot ${account.is_online ? 'status-dot-online pulse-online' : 'status-dot-offline'}`}></div>
                  <span className="text-sm text-muted-foreground">Status</span>
                </div>
                <p className={`font-semibold ${account.is_online ? 'text-green-400' : 'text-red-400'}`}>
                  {account.is_online ? 'Online' : 'Offline'}
                </p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Devices</span>
                </div>
                <p className="data-value text-xl">{devices.length}</p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Router className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Extenders</span>
                </div>
                <p className="data-value text-xl">{extenders.length}</p>
              </div>
              <div className="p-4 bg-secondary/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Checked</span>
                </div>
                <p className="text-sm">{formatDistanceToNow(new Date(account.last_checked), { addSuffix: true })}</p>
              </div>
            </div>
            {editing && (
              <div className="mt-4 flex items-center gap-4 p-4 bg-secondary/20 rounded-sm">
                <Label>Connection Status:</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={editData.is_online} onCheckedChange={(v) => setEditData({ ...editData, is_online: v })} />
                  <span>{editData.is_online ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Billing, Tickets, Extenders, Devices */}
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="devices" data-testid="tab-devices">Devices ({devices.length})</TabsTrigger>
            <TabsTrigger value="extenders" data-testid="tab-extenders">Extenders ({extenders.length})</TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">Billing ({billingRecords.length})</TabsTrigger>
            <TabsTrigger value="tickets" data-testid="tab-tickets">Tickets ({tickets.length})</TabsTrigger>
          </TabsList>

          {/* Devices Tab */}
          <TabsContent value="devices">
            <Card className="bg-card border-border/40">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Connected Devices</CardTitle>
                <Dialog open={showDeviceModal} onOpenChange={setShowDeviceModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="add-device-btn"><Plus className="w-4 h-4 mr-2" /> Add Device</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Device</DialogTitle></DialogHeader>
                    <form onSubmit={addDevice} className="space-y-4 mt-4">
                      <div className="form-group">
                        <Label>Device Name *</Label>
                        <Input value={deviceForm.name} onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} required data-testid="device-name-input" />
                      </div>
                      <div className="form-group">
                        <Label>MAC Address *</Label>
                        <Input value={deviceForm.mac_address} onChange={(e) => setDeviceForm({ ...deviceForm, mac_address: e.target.value })} placeholder="XX:XX:XX:XX:XX:XX" required data-testid="mac-input" />
                      </div>
                      <div className="form-group">
                        <Label>Device Type</Label>
                        <Select value={deviceForm.device_type} onValueChange={(v) => setDeviceForm({ ...deviceForm, device_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unknown">Unknown</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="laptop">Laptop</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                            <SelectItem value="tv">Smart TV</SelectItem>
                            <SelectItem value="iot">IoT Device</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group">
                        <Label>Connected To Extender</Label>
                        <Select value={deviceForm.extender_id || "main_router"} onValueChange={(v) => setDeviceForm({ ...deviceForm, extender_id: v === "main_router" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Main Router" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main_router">Main Router</SelectItem>
                            {extenders.map((ext) => <SelectItem key={ext.extender_id} value={ext.extender_id}>{ext.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowDeviceModal(false)}>Cancel</Button>
                        <Button type="submit" data-testid="submit-device-btn">Add Device</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {devices.length > 0 ? (
                  <div className="space-y-3">
                    {devices.map((device, i) => (
                      <div key={device.device_id} className="device-item" data-testid={`device-item-${i}`}>
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="data-value text-xs text-muted-foreground">{device.mac_address}</p>
                          </div>
                          <Badge variant="outline" className="ml-2">{device.device_type}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={device.is_whitelisted ? 'badge-online' : 'badge-offline'}>
                            {device.is_whitelisted ? 'Whitelisted' : 'Blocked'}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => toggleDeviceWhitelist(device.device_id, device.is_whitelisted)}>
                            {device.is_whitelisted ? 'Block' : 'Whitelist'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state py-8">
                    <Smartphone className="empty-state-icon" />
                    <p className="empty-state-title">No devices</p>
                    <p className="empty-state-description">Add devices to track them</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extenders Tab */}
          <TabsContent value="extenders">
            <Card className="bg-card border-border/40">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Extenders / Sub-Routers</CardTitle>
                <Dialog open={showExtenderModal} onOpenChange={setShowExtenderModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="add-extender-btn"><Plus className="w-4 h-4 mr-2" /> Add Extender</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Extender</DialogTitle></DialogHeader>
                    <form onSubmit={addExtender} className="space-y-4 mt-4">
                      <div className="form-group">
                        <Label>Name *</Label>
                        <Input value={extenderForm.name} onChange={(e) => setExtenderForm({ ...extenderForm, name: e.target.value })} required data-testid="extender-name-input" />
                      </div>
                      <div className="form-group">
                        <Label>IP Address</Label>
                        <Input value={extenderForm.ip_address} onChange={(e) => setExtenderForm({ ...extenderForm, ip_address: e.target.value })} placeholder="192.168.1.x" />
                      </div>
                      <div className="form-group">
                        <Label>Location</Label>
                        <Input value={extenderForm.location} onChange={(e) => setExtenderForm({ ...extenderForm, location: e.target.value })} placeholder="e.g., Second Floor" />
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowExtenderModal(false)}>Cancel</Button>
                        <Button type="submit" data-testid="submit-extender-btn">Add Extender</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {extenders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {extenders.map((ext, i) => (
                      <div key={ext.extender_id} className="extender-card" data-testid={`extender-item-${i}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Router className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium">{ext.name}</p>
                              {ext.location && <p className="text-xs text-muted-foreground">{ext.location}</p>}
                            </div>
                          </div>
                          <Badge className={ext.is_online ? 'badge-online' : 'badge-offline'}>
                            {ext.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          {ext.ip_address && <span className="data-value">{ext.ip_address}</span>}
                          <span className="text-muted-foreground">{ext.devices_connected} devices</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state py-8">
                    <Router className="empty-state-icon" />
                    <p className="empty-state-title">No extenders</p>
                    <p className="empty-state-description">Add mesh extenders or sub-routers</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <Card className="bg-card border-border/40">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Payment History</CardTitle>
                <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="add-payment-btn"><Plus className="w-4 h-4 mr-2" /> Record Payment</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                    <form onSubmit={addPayment} className="space-y-4 mt-4">
                      <div className="form-group">
                        <Label>Amount ($) *</Label>
                        <Input type="number" step="0.01" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })} required data-testid="payment-amount-input" />
                      </div>
                      <div className="form-group">
                        <Label>Payment Date *</Label>
                        <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} required data-testid="payment-date-input" />
                      </div>
                      <div className="form-group">
                        <Label>Payment Method</Label>
                        <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-group">
                        <Label>Notes</Label>
                        <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} />
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                        <Button type="submit" data-testid="submit-payment-btn">Record Payment</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {billingRecords.length > 0 ? (
                  <div className="space-y-3">
                    {billingRecords.map((record, i) => (
                      <div key={record.billing_id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-sm" data-testid={`billing-item-${i}`}>
                        <div>
                          <p className="font-medium">{format(new Date(record.payment_date), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">{record.payment_method} {record.notes && `- ${record.notes}`}</p>
                        </div>
                        <span className="data-value text-primary text-lg">${record.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state py-8">
                    <CreditCard className="empty-state-icon" />
                    <p className="empty-state-title">No payment records</p>
                    <p className="empty-state-description">Record payments to track billing history</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets">
            <Card className="bg-card border-border/40">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Support Tickets</CardTitle>
                <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="add-ticket-btn"><Plus className="w-4 h-4 mr-2" /> Create Ticket</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
                    <form onSubmit={addTicket} className="space-y-4 mt-4">
                      <div className="form-group">
                        <Label>Title *</Label>
                        <Input value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} required data-testid="ticket-title-input" />
                      </div>
                      <div className="form-group">
                        <Label>Description *</Label>
                        <Textarea value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} required rows={4} data-testid="ticket-desc-input" />
                      </div>
                      <div className="form-group">
                        <Label>Priority</Label>
                        <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm({ ...ticketForm, priority: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowTicketModal(false)}>Cancel</Button>
                        <Button type="submit" data-testid="submit-ticket-btn">Create Ticket</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tickets.length > 0 ? (
                  <div className="space-y-3">
                    {tickets.map((ticket, i) => (
                      <div key={ticket.ticket_id} className="p-4 bg-secondary/30 rounded-sm border border-border/30" data-testid={`ticket-item-${i}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{ticket.title}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`badge-${ticket.priority}`}>{ticket.priority}</Badge>
                              <Badge className={ticket.status === 'open' ? 'badge-open' : 'badge-closed'}>{ticket.status}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                          {ticket.status === 'open' && (
                            <Button size="sm" variant="ghost" onClick={() => updateTicketStatus(ticket.ticket_id, 'closed')}>
                              <Check className="w-4 h-4 mr-1" /> Close
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state py-8">
                    <AlertTriangle className="empty-state-icon" />
                    <p className="empty-state-title">No tickets</p>
                    <p className="empty-state-description">Create support tickets to track issues</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
