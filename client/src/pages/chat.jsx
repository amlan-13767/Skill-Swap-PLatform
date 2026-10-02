import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Send, UserRound } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

function ChatPage({ conversationId }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const conversationsQuery = useQuery({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/chat/conversations", { credentials: "include" });
      if (!response.ok) throw new Error("We could not load your conversations.");
      return response.json();
    },
    refetchInterval: 15000,
  });
  const conversations = conversationsQuery.data?.conversations ?? [];
  const selected = conversations.find((conversation) => String(conversation.id) === String(conversationId));
  const messagesQuery = useQuery({
    queryKey: ["/api/chat/conversations", conversationId, "messages"],
    enabled: Boolean(conversationId && selected),
    queryFn: async () => {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have access to this conversation." : "We could not load these messages.");
      return response.json();
    },
    refetchInterval: 8000,
  });
  const sendMessage = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/chat/conversations/${conversationId}/messages`, { content: content.trim() });
      return response.json();
    },
    onSuccess: () => {
      setContent("");
      void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", conversationId, "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return <AppShell pageLabel="Chat"><div className="shell app-page">
    <div className="page-heading-row"><div><span className="eyebrow text-cyan-300">Accepted learning exchanges</span><h1>Chat</h1><p>Keep your skill exchange moving with a direct conversation.</p></div><Link href="/requests"><Button variant="outline">View requests</Button></Link></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
      <section className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/30">
        <div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-white">Conversations</h2><p className="mt-1 text-sm text-slate-400">Only accepted exchanges appear here.</p></div>
        {conversationsQuery.isLoading && <div className="space-y-3 p-5" aria-label="Loading conversations">{[1, 2].map((item) => <div className="dashboard-skeleton h-16" key={item} />)}</div>}
        {conversationsQuery.isError && <div className="p-5"><p className="text-sm text-rose-200">{conversationsQuery.error.message}</p><Button className="mt-3" variant="outline" onClick={() => conversationsQuery.refetch()}>Try again</Button></div>}
        {!conversationsQuery.isLoading && !conversationsQuery.isError && conversations.length === 0 && <div className="p-6 text-center"><MessageCircle className="mx-auto mb-3 h-6 w-6 text-cyan-200" /><h3 className="font-medium text-white">No conversations yet</h3><p className="mt-2 text-sm text-slate-400">When someone accepts a swap request, your conversation will show up here.</p><Link href="/requests"><Button className="mt-4" variant="outline">Open requests</Button></Link></div>}
        <div className="divide-y divide-white/10">{conversations.map((conversation) => <Link key={conversation.id} href={`/chat/${conversation.id}`} aria-current={String(conversation.id) === String(conversationId) ? "page" : undefined} className={`flex items-center gap-3 border-l-2 px-4 py-4 transition hover:bg-white/[0.04] ${String(conversation.id) === String(conversationId) ? "border-cyan-200 bg-cyan-300/[0.08]" : "border-transparent"}`}>
          {conversation.participant?.avatar ? <img className="h-11 w-11 rounded-full object-cover" src={conversation.participant.avatar} alt="" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-cyan-100"><UserRound className="h-5 w-5" /></span>}
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-white">{conversation.participant?.name || "Learner"}</span><span className="block truncate text-sm text-slate-400">{conversation.lastMessage?.content || "Start your conversation"}</span></span>
          <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">{conversation.lastMessage?.createdAt ? new Date(conversation.lastMessage.createdAt).toLocaleDateString() === new Date().toLocaleDateString() ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : new Date(conversation.lastMessage.createdAt).toLocaleDateString() : ""}{conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 font-semibold text-slate-950">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}</span>
        </Link>)}</div>
      </section>
      {!conversationId && <div className="app-empty min-h-80"><MessageCircle /><h2>Choose a conversation</h2><p>Select an accepted exchange to read and send messages.</p></div>}
      {conversationId && <section className="flex min-h-[480px] flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-950/30">
        {messagesQuery.isLoading && <div className="app-empty flex-1"><MessageCircle /><p>Loading messages...</p></div>}
        {messagesQuery.isError && <div className="app-empty flex-1"><MessageCircle /><h2>Unable to open conversation</h2><p>{messagesQuery.error.message}</p><Link href="/chat"><Button variant="outline"><ArrowLeft /> Back to conversations</Button></Link></div>}
        {!messagesQuery.isLoading && !messagesQuery.isError && !selected && <div className="app-empty flex-1"><MessageCircle /><h2>Conversation unavailable</h2><p>This conversation is not available to your account.</p><Link href="/chat"><Button variant="outline"><ArrowLeft /> Back to conversations</Button></Link></div>}
        {selected && !messagesQuery.isLoading && !messagesQuery.isError && <>
          <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><Link href="/chat" className="text-slate-400 hover:text-white" aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Link>{selected.participant?.avatar ? <img className="h-10 w-10 rounded-full object-cover" src={selected.participant.avatar} alt="" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><UserRound className="h-5 w-5" /></span>}<div><h2 className="font-semibold text-white">{selected.participant?.name || "Learner"}</h2><Link href={`/profile?user=${selected.participant?.id}`} className="text-xs text-cyan-200 hover:underline">View profile</Link></div></header>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">{(messagesQuery.data?.messages ?? []).length === 0 && <div className="my-auto text-center"><MessageCircle className="mx-auto mb-3 h-6 w-6 text-cyan-200" /><h3 className="font-medium text-white">Start the conversation</h3><p className="mt-1 text-sm text-slate-400">Say hello and plan your first learning exchange.</p></div>}{(messagesQuery.data?.messages ?? []).map((message) => <article key={message.id} className={`max-w-[85%] rounded-lg border px-4 py-3 ${message.senderUserId === selected.participant?.id ? "self-start border-white/10 bg-white/[0.04]" : "self-end border-cyan-200/20 bg-cyan-300/[0.08]"}`}><p className="whitespace-pre-wrap break-words text-sm text-slate-100">{message.content}</p><time className="mt-2 block text-right text-[11px] text-slate-500" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></article>)}</div>
          <form className="border-t border-white/10 p-4" onSubmit={(event) => { event.preventDefault(); if (content.trim()) sendMessage.mutate(); }}><label className="sr-only" htmlFor="chat-message">Message</label><Textarea id="chat-message" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a message..." maxLength={2000} rows={3} className="resize-y" /><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">Messages are shared only with this exchange partner.</span><Button type="submit" disabled={!content.trim() || sendMessage.isPending}>{sendMessage.isPending ? "Sending..." : "Send message"} <Send /></Button></div>{sendMessage.isError && <p role="alert" className="mt-2 text-sm text-rose-200">{sendMessage.error.message || "Message could not be sent. Please try again."}</p>}</form>
        </>}
      </section>}
    </div>
  </div></AppShell>;
}

export default ChatPage;
