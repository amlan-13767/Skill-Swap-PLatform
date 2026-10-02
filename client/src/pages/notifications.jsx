import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Check, CheckCheck, MessageSquareText, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getNotificationAction(notification) {
  if (notification.relatedEntityType === "chat_conversation" && notification.relatedEntityId) {
    return { label: "Open chat", href: `/chat/${notification.relatedEntityId}` };
  }
  if (notification.relatedEntityType === "swap_request" && notification.relatedEntityId) {
    return { label: "View request", href: `/requests#request-${notification.relatedEntityId}` };
  }
  return { label: "View notifications", href: "/notifications" };
}

function NotificationIcon({ type }) {
  if (type === "chat_message") return <MessageSquareText />;
  if (type === "swap_request_accepted") return <Check />;
  if (type === "swap_request_rejected" || type === "swap_request_cancelled") return <X />;
  return <Bell />;
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load notifications.");
      return response.json();
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const markRead = useMutation({
    mutationFn: (id) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const notifications = query.data?.notifications ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return <AppShell pageLabel="Notifications"><div className="shell app-page narrow-page">
    <div className="page-heading-row"><div><span className="eyebrow text-cyan-300">Stay in the loop</span><h1>Notifications</h1><p>Important moments from your learning connections will appear here.</p></div>{notifications.length > 0 && <Button variant="outline" disabled={markAllRead.isPending || unreadCount === 0} onClick={() => markAllRead.mutate()}>{markAllRead.isPending ? "Marking all read..." : "Mark all as read"}</Button>}</div>
    {markAllRead.isError && <p role="alert" className="mb-4 text-sm text-rose-200">We couldn't update your notifications. Please try again.</p>}
    {query.isLoading && <div className="app-empty"><Bell /><p>Loading notifications…</p></div>}
    {query.isError && <div className="app-empty"><Bell /><h2>Something went wrong</h2><p>We could not load your notifications.</p><Button onClick={() => query.refetch()}>Try again</Button></div>}
    {!query.isLoading && !query.isError && <div className="stacked-list">
      {notifications.length === 0 ? <div className="app-empty notification-empty"><Bell /><h2>Your inbox is quiet</h2><p>Swap requests, decisions, and messages will appear here when they arrive.</p><Link href="/browse"><Button>Browse learners <ArrowRight /></Button></Link></div> : notifications.map((notification) => {
        const action = getNotificationAction(notification);
        const readBeforeNavigate = async () => {
          if (notification.read) return;
          await markRead.mutateAsync(notification.id);
        };
        const openAction = async (event) => {
          event.preventDefault();
          try {
            await readBeforeNavigate();
            navigate(action.href);
          } catch {
            query.refetch();
          }
        };
        return <div key={notification.id} className={`notification-item ${notification.read ? "is-read" : "is-unread"}`}>
          <div className="notification-item-main">
            <div className="notification-icon"><NotificationIcon type={notification.type} /></div>
            <div className="notification-copy">
              <div className="notification-header">
                <span className="notification-type">{notification.type === "chat_message" ? "NEW" : "UPDATE"}</span>
                {!notification.read && <span className="notification-dot" />}
              </div>
              <h3>{notification.title}</h3>
              <p>{notification.message}</p>
              <div className="notification-meta">
                <span>{formatRelativeTime(notification.createdAt)}</span>
                {!notification.read && <Button variant="link" className="notification-read-link" disabled={markRead.isPending && markRead.variables === notification.id} onClick={() => markRead.mutate(notification.id)}><CheckCheck />{markRead.isPending && markRead.variables === notification.id ? "Marking read..." : "Mark as read"}</Button>}
              </div>
              {markRead.isError && markRead.variables === notification.id && <p role="alert" className="mt-2 text-xs text-rose-200">Couldn't update this notification. Try again.</p>}
            </div>
          </div>
          <Link href={action.href} onClick={openAction}><Button variant="outline" size="sm">{action.label}</Button></Link>
        </div>;
      })}
    </div>}
  </div></AppShell>;
}
