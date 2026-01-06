import { useState } from "react";
import { useAuth, API } from "App";
import { User, Mail, Shield, Phone, Bell, MessageSquare, Save } from "lucide-react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "components/ui/card";
import { Badge } from "components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "components/ui/avatar";
import { toast } from "sonner";

export default function Settings() {
  const auth = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(auth.user?.phone_number || "");
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSms, setTestingSms] = useState(false);

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

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
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={auth.user?.picture} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
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
                    <Badge className={auth.user?.role === 'admin' ? 'badge-online' : 'badge-medium'}>
                      <Shield className="w-3 h-3 mr-1" />
                      {auth.user?.role || 'viewer'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phone Number Card */}
        <Card className="bg-card border-border/40" data-testid="phone-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
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
              <Bell className="w-5 h-5 text-primary" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure and test your payment reminder notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-sm space-y-3">
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
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
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
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
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
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-sm">
                <div>
                  <p className="font-medium">User ID</p>
                  <p className="data-value text-xs text-muted-foreground">{auth.user?.user_id}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-sm">
                <div>
                  <p className="font-medium">Authentication Method</p>
                  <p className="text-sm text-muted-foreground">
                    {auth.user?.picture ? 'Google OAuth' : 'Email & Password'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card className="bg-card border-border/40">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm">
                <span>Create & Edit Accounts</span>
                <Badge className={auth.user?.role === 'admin' ? 'badge-online' : 'badge-offline'}>
                  {auth.user?.role === 'admin' ? 'Allowed' : 'Restricted'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm">
                <span>Delete Accounts</span>
                <Badge className={auth.user?.role === 'admin' ? 'badge-online' : 'badge-offline'}>
                  {auth.user?.role === 'admin' ? 'Allowed' : 'Restricted'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm">
                <span>Manage Billing Records</span>
                <Badge className={auth.user?.role === 'admin' ? 'badge-online' : 'badge-offline'}>
                  {auth.user?.role === 'admin' ? 'Allowed' : 'Restricted'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-sm">
                <span>View All Data</span>
                <Badge className="badge-online">Allowed</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
