import { useState, useEffect } from "react";
import { useAuth, API } from "App";
import { Bell, Check, Trash2, X } from "lucide-react";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "components/ui/popover";
import { ScrollArea } from "components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export const NotificationBell = () => {
  const auth = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API}/notifications`, {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API}/notifications/count`, {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count);
      }
    } catch (error) {}
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API}/notifications/${notificationId}/read`, {
        method: "PUT",
        credentials: "include",
        headers,
      });
      setNotifications(notifications.map(n => 
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {}
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: "PUT",
        credentials: "include",
        headers,
      });
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {}
  };

  const deleteNotification = async (notificationId) => {
    try {
      await fetch(`${API}/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      const wasUnread = notifications.find(n => n.notification_id === notificationId && !n.is_read);
      setNotifications(notifications.filter(n => n.notification_id !== notificationId));
      if (wasUnread) setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {}
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "payment_reminder":
        return "💳";
      case "alert":
        return "⚠️";
      default:
        return "📢";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() => {
            setOpen(true);
            fetchNotifications();
          }}
          data-testid="notification-bell"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className={`p-4 hover:bg-secondary/30 transition-colors ${
                    !notification.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getNotificationIcon(notification.notification_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => markAsRead(notification.notification_id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification(notification.notification_id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
