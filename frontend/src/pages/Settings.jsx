import { useState } from "react";
import { useAuth } from "@/App";
import { User, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useAuth } from "@/App";

export default function Settings() {
  const auth = useAuth();
  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div data-testid="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
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
