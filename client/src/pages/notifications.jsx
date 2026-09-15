import { Bell, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export default function Notifications() {
  return <AppShell pageLabel="Notifications"><div className="shell app-page narrow-page"><div className="page-heading"><span className="eyebrow text-cyan-300">Stay in the loop</span><h1>Notifications</h1><p>Important moments from your learning connections will appear here.</p></div><div className="app-empty notification-empty"><Bell /><h2>Your inbox is quiet</h2><p>Notifications are not connected yet. You can still manage every request from your Requests dashboard.</p><Link href="/requests"><Button>Open requests <CheckCircle2 /></Button></Link></div></div></AppShell>;
}
