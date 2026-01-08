import { useState, useEffect } from "react";
import { useAuth, API } from "../App";
import { User, Mail, Shield, Phone, Bell, MessageSquare, Save, RefreshCw, Unlink, Check, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { toast } from "sonner";

const GOOGLE_CLIENT_ID = "1076605813360-tkleimc080a64nhu4ab4f4rk9ifj6qps.apps.googleusercontent.com";

export default function Settings() {
  const auth = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(auth.user?.phone_number || "");
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, loading: true });
  const [syncing, setSyncing] = useState(false);

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  useEffect(() => {
    checkGmailStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGmailStatus = async () => {
    try {
      const response = await fetch(`${API}/gmail/status`, {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setGmailStatus({ ...data, loading: false });
      } else {
        setGmailStatus({ connected: false, loading: false });
      }
    } catch (error) {
      setGmailStatus({ connected: false, loading: false });
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSavePhone = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ phone_number: phoneNumber || null }),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        auth.login(updatedUser);
        toast.success("Phone number updated");
      } else {
        toast.error("Failed to update phone number");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const response = await fetch(`${API}/reminders/test-email`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Test email sent! Check your inbox.");
      } else {
        toast.error("Failed to send test email");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSms = async () => {
    if (!auth.user?.phone_number) {
      toast.error("Please save a phone number first");
      return;
    }
    setTestingSms(true);
    try {
      const response = await fetch(`${API}/reminders/test-sms`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Test SMS sent!");
      } else {
        toast.error(data.message || "Failed to send test SMS");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setTestingSms(false);
    }
  };

  const handleCheckReminders = async () => {
    try {
      const response = await fetch(`${API}/reminders/check`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (response.ok) {
        toast.success("Reminder check initiated");
      }
    } catch (error) {
      toast.error("Failed to check reminders");
    }
  };

  const handleConnectGmail = () => {
    const redirectUri = window.location.origin + '/settings';
    const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/gmail.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  // Handle OAuth callback on settings page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      handleGmailCallback(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGmailCallback = async (code) => {
    try {
      const response = await fetch(`${API}/auth/google/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ code, redirect_uri: window.location.origin + '/settings' }),
      });

      if (response.ok) {
        toast.success("Gmail connected successfully!");
        window.history.replaceState({}, document.title, '/settings');
        checkGmailStatus();
      } else {
        toast.error("Failed to connect Gmail");
        window.history.replaceState({}, document.title, '/settings');
      }
    } catch (error) {
      toast.error("Connection error");
      window.history.replaceState({}, document.title, '/settings');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const response = await fetch(`${API}/gmail/disconnect`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (response.ok) {
        toast.success("Gmail disconnected");
        setGmailStatus({ connected: false, loading: false });
      }
    } catch (error) {
      toast.error("Failed to disconnect Gmail");
    }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API}/gmail/sync`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Synced ${data.synced} emails`);
      } else {
        toast.error(data.detail || "Failed to sync emails");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div data-testid="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and notification settings</p>
      </div>

      <div className="p-6 lg:p-8 space-y-6">
        {/* Profile Card */}
        <Card className="bg-card border-border/40" data-testid="profile-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-500" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={auth.user?.picture} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl">
                  {getInitials(auth.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</label>
                  <p className="font-medium mt-1">{auth.user?.name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <p className="font-medium mt-1 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {auth.user?.email}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Role</label>
                  <div className="mt-1">
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {auth.user?.role || 'viewer'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gmail Sync Card */}
        <Card className="bg-card border-border/40" data-testid="gmail-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-500" />
              Email Sync (Starlink Emails)
            </CardTitle>
            <CardDescription>
              Connect your Gmail to automatically sync emails from Starlink
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${gmailStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="font-medium">
                    {gmailStatus.loading ? 'Checking...' : gmailStatus.connected ? 'Gmail Connected' : 'Gmail Not Connected'}
                  </span>
                </div>
                {gmailStatus.connected && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                When connected, StarOps Konexa will scan your inbox for emails from Starlink (@starlink.com, @spacex.com) and create notifications linked to your accounts.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {gmailStatus.connected ? (
                <>
                  <Button 
                    onClick={handleSyncEmails}
                    disabled={syncing}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    {syncing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Emails Now
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDisconnectGmail}
                    className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect Gmail
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={handleConnectGmail}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  disabled={gmailStatus.loading}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Connect Gmail
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Phone Number Card */}
        <Card className="bg-card border-border/40" data-testid="phone-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Phone className="w-5 h-5 text-cyan-500" />
              Phone Number
            </CardTitle>
            <CardDescription>
              Add your phone number to receive SMS payment reminders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="mt-1"
                  data-testid="settings-phone-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSavePhone} disabled={saving} data-testid="save-phone-btn">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card border-border/40" data-testid="notifications-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-500" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure and test your payment reminder notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <h4 className="font-medium">Payment Reminders</h4>
              <p className="text-sm text-muted-foreground">
                You will receive payment reminders via:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>In-app notifications</strong> - Always enabled</li>
                <li>• <strong>Email</strong> - Sent to {auth.user?.email}</li>
                <li>• <strong>SMS</strong> - Sent to {auth.user?.phone_number || "Not configured"}</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Reminders are sent 5 days, 3 days, and 1 day before billing date.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={handleTestEmail}
                disabled={testingEmail}
                data-testid="test-email-btn"
              >
                {testingEmail ? (
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Test Email
              </Button>
              <Button 
                variant="outline" 
                onClick={handleTestSms}
                disabled={testingSms || !auth.user?.phone_number}
                data-testid="test-sms-btn"
              >
                {testingSms ? (
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-2" />
                )}
                Test SMS
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCheckReminders}
                data-testid="check-reminders-btn"
              >
                <Bell className="w-4 h-4 mr-2" />
                Check Reminders Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-card border-border/40">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium">User ID</p>
                  <p className="data-value text-xs text-muted-foreground">{auth.user?.user_id}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium">Account Created</p>
                  <p className="text-sm text-muted-foreground">
                    {auth.user?.created_at ? new Date(auth.user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
