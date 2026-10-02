import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Clock3, Inbox, MapPin, Send, X } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

function StatusBadge({ status }) { const icon = { pending: Clock3, accepted: Check, rejected: X, cancelled: X }[status] || Clock3; const Icon = icon; const label = status ? `${status[0].toUpperCase()}${status.slice(1)}` : "Unknown"; return <Badge className={`status-badge status-${status}`}><Icon /> {label}</Badge>; }

function requestUpdateError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("forbidden")) return "You do not have permission to update this request.";
  if (message.includes("only pending")) return "This request is no longer pending.";
  if (message.includes("authentication required")) return "Please log in to update this request.";
  return "Unable to update this request. Please try again.";
}

function RequestCard({ request, incoming, participant, participantLoading, mutation }) {
  const otherUser = participant;
  const updatedByAction = mutation.isPending && mutation.variables?.id === request.id;
  const requestedSkills = otherUser?.skillsOffered;

  return <Card id={`request-${request.id}`} className="request-card"><CardContent className="p-5">
    <div className="request-card-head">
      <div className="request-avatar">{incoming ? <Inbox /> : <Send />}</div>
      <div className="min-w-0">
        <span className="eyebrow">{incoming ? "Incoming request" : "Sent request"}</span>
        {otherUser ? <Link href={`/profile?user=${otherUser.id}`} className="block truncate text-lg font-semibold text-white hover:text-cyan-200">{otherUser.name}</Link> : <h2>{participantLoading ? "Loading learner profile..." : "Learner profile unavailable"}</h2>}
        <span className="user-meta"><MapPin /> {participantLoading ? "Loading profile details..." : otherUser?.location || "Location not provided"}</span>
      </div>
      <StatusBadge status={request.status} />
    </div>
    <div className="request-profile-details grid gap-1.5 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
      <p><strong>{incoming ? "They offer" : "Recipient offers"}:</strong> {participantLoading ? "Loading..." : (requestedSkills || []).join(", ") || "Not listed"}</p>
      <p><strong>{incoming ? "They want to learn" : "Recipient wants to learn"}:</strong> {participantLoading ? "Loading..." : (otherUser?.skillsWanted || []).join(", ") || "Not listed"}</p>
      <p><strong>Availability:</strong> {participantLoading ? "Loading..." : (otherUser?.availability || []).join(", ") || "Flexible"}</p>
    </div>
    <p className="request-message">{request.message || "No message was included with this request."}</p>
    <div className="request-meta">
      <span>{request.createdAt ? new Date(request.createdAt).toLocaleString() : "Date unavailable"}</span>
      {request.status === "accepted" && <span className="request-success"><Check /> Exchange accepted</span>}
    </div>
    {request.status === "pending" && <div className="request-actions">
      {incoming ? <>
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, status: "accepted" })}>{updatedByAction ? "Accepting..." : "Accept"} <Check /></Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, status: "rejected" })}>{updatedByAction ? "Declining..." : "Decline"} <X /></Button>
      </> : <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, status: "cancelled" })}>{updatedByAction ? "Cancelling..." : "Cancel Request"} <X /></Button>}
    </div>}
    {request.status === "accepted" && <div className="request-actions"><Link href="/chat"><Button variant="outline">Open chat <ArrowRight /></Button></Link></div>}
  </CardContent></Card>;
}

export default function Requests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["/api/swap-requests"],
    queryFn: async () => {
      const response = await fetch("/api/swap-requests", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load requests.");
      return response.json();
    },
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }) => apiRequest("PATCH", `/api/swap-requests/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: variables.status === "accepted" ? "Request accepted" : variables.status === "rejected" ? "Request declined" : "Request cancelled" });
    },
    onError: (error) => toast({ title: "Request update failed", description: requestUpdateError(error), variant: "destructive" }),
  });

  const requests = query.data?.requests ?? [];
  const received = requests.filter((request) => request.toUserId === user.id);
  const sent = requests.filter((request) => request.fromUserId === user.id);
  const participantIds = [...new Set(requests.map((request) => request.fromUserId === user.id ? request.toUserId : request.fromUserId))];
  const participantQueries = useQueries({ queries: participantIds.map((id) => ({
    queryKey: ["/api/users", String(id)],
    queryFn: async () => {
      const response = await fetch(`/api/users/${id}`, { credentials: "include" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.user;
    },
  })) });
  const participants = Object.fromEntries(participantIds.map((id, index) => [id, {
    user: participantQueries[index]?.data,
    isLoading: participantQueries[index]?.isLoading,
  }]));
  const renderRequests = (items, incoming) => items.length
    ? items.map((request) => {
      const participant = participants[incoming ? request.fromUserId : request.toUserId];
      return <RequestCard key={`${incoming ? "received" : "sent"}-${request.id}`} request={request} incoming={incoming} participant={participant?.user} participantLoading={participant?.isLoading} mutation={mutation} />;
    })
    : <div className="mini-empty"><p>{incoming ? "No incoming requests yet." : "You have not sent a request yet."}</p><Link href={incoming ? "/browse" : "/matches"}><Button className="mt-3" size="sm" variant="outline">{incoming ? "Browse learners" : "Find a match"} <ArrowRight /></Button></Link></div>;

  return <AppShell pageLabel="Requests"><div className="shell app-page">
    <div className="page-heading-row"><div><span className="eyebrow text-cyan-300">Your activity</span><h1>Swap requests.</h1><p>Keep every learning connection moving in the right direction.</p></div><Link href="/browse"><Button>Find people <ArrowRight /></Button></Link></div>
    {query.isLoading && <div className="app-card-grid">{[1, 2].map((item) => <div className="dashboard-skeleton request-skeleton" key={item} />)}</div>}
    {query.isError && <div className="app-empty"><Inbox /><h2>Something went wrong</h2><p>We could not load your requests. Please try again.</p><Button onClick={() => query.refetch()}>Try again</Button></div>}
    {!query.isLoading && !query.isError && <div className="request-columns">
      <section><div className="section-label"><Inbox /><div><h2>Received</h2><span>People reaching out to you</span></div></div>{renderRequests(received, true)}</section>
      <section><div className="section-label"><Send /><div><h2>Sent</h2><span>Your requests to other learners</span></div></div>{renderRequests(sent, false)}</section>
    </div>}
  </div></AppShell>;
}
