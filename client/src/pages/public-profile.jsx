import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MapPin, Sparkles, Star } from "lucide-react";
import { Link } from "wouter";
import SwapRequestAction from "@/components/SwapRequestAction";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";

function SkillCard({ title, skills, color }) {
  return <Card className="profile-skill-card">
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent><div className="large-skill-list">
      {skills?.length ? skills.map((skill) => <span className={`large-skill ${color}`} key={skill}>{skill}</span>) : <span className="muted-copy">No skills listed.</span>}
    </div></CardContent>
  </Card>;
}

export default function PublicProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const searchParams = new URLSearchParams(window.location.search);
  const targetId = searchParams.get("user");
  const score = Number(searchParams.get("matchScore"));
  const skills = searchParams.get("matchSkills")?.split(",").filter(Boolean) ?? [];
  const matchContext = score > 0 ? { score, skills } : null;
  const profileQuery = useQuery({
    queryKey: ["/api/users", targetId],
    enabled: Boolean(targetId),
    queryFn: async () => {
      const response = await fetch(`/api/users/${targetId}`, { credentials: "include" });
      if (!response.ok) throw new Error("This learner is no longer available.");
      const data = await response.json();
      return data;
    },
  });
  const reviewsQuery = useQuery({
    queryKey: ["/api/users", targetId, "reviews"],
    enabled: Boolean(targetId),
    queryFn: async () => {
      const response = await fetch(`/api/users/${targetId}/reviews`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load reviews for this learner.");
      return response.json();
    },
  });
  const requestsQuery = useQuery({
    queryKey: ["/api/swap-requests"],
    enabled: Boolean(user && targetId),
    queryFn: async () => {
      const response = await fetch("/api/swap-requests", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to check review eligibility.");
      return response.json();
    },
  });
  const submitReview = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/users/${targetId}/reviews`, { rating, comment: comment.trim() || null });
      return response.json();
    },
    onSuccess: () => {
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["/api/users", targetId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/users", targetId, "reviews"] });
    },
  });

  if (profileQuery.isLoading) {
    return <AppShell pageLabel="Profile"><div className="shell app-page"><div className="app-empty"><Sparkles /><p>Loading profile...</p></div></div></AppShell>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <AppShell pageLabel="Profile"><div className="shell app-page"><div className="app-empty"><Sparkles /><h2>This learner is no longer available.</h2><Link href="/browse"><Button variant="outline"><ArrowLeft /> Back to browse</Button></Link></div></div></AppShell>;
  }

  const profile = profileQuery.data.user;
  const ratingSummary = profileQuery.data.ratingSummary ?? { average: 0, count: 0 };
  const reviews = reviewsQuery.data?.reviews ?? [];
  const eligibleRequest = requestsQuery.data?.requests?.find((request) => request.status === "accepted" && (
    (request.fromUserId === user.id && request.toUserId === profile.id) ||
    (request.fromUserId === profile.id && request.toUserId === user.id)
  ));
  const hasReviewedExchange = eligibleRequest && reviews.some((review) => review.swapRequestId === eligibleRequest.id);
  const canReview = profile.id !== user.id && eligibleRequest && !hasReviewedExchange;

  return <AppShell pageLabel="Profile"><div className="shell app-page">
    <div className="profile-hero-card">
      <div className="profile-hero-main">
        <img className="profile-large-avatar" src={profile.avatar || "https://placehold.co/180x180/171a35/9ba7ff?text=SS"} alt={profile.name} />
        <div>
          <span className="eyebrow text-cyan-300">Public profile</span>
          <h1>{profile.name}</h1>
          <p className="user-meta"><MapPin /> {profile.location || "Location not provided"}</p>
          <div className="profile-pills"><span><Sparkles /> Public profile</span></div>
          {matchContext && <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-4">
            <strong className="text-cyan-100">{matchContext.score}% match</strong>
            {matchContext.skills.length > 0 && <p className="mt-1 text-sm text-slate-300">They offer {matchContext.skills.join(", ")}, which match your learning goals.</p>}
            <p className="mt-1 text-sm text-slate-400">Your offered skills also complement what they want to learn.</p>
          </div>}
        </div>
      </div>
      {profile.id === user.id && <Link href="/profile"><Button variant="outline">Edit Profile</Button></Link>}
    </div>
    <div className="profile-content-grid">
      <SkillCard title="They can teach" skills={profile.skillsOffered} color="blue" />
      <SkillCard title="They want to learn" skills={profile.skillsWanted} color="purple" />
    </div>
    <section className="mt-5 grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
        <CardContent><div className="flex flex-wrap gap-2">{profile.availability?.length ? profile.availability.map((slot) => <span key={slot} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm capitalize text-slate-200">{slot}</span>) : <span className="text-sm text-slate-400">No availability listed.</span>}</div></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Community rating</CardTitle></CardHeader>
        <CardContent><div className="flex items-center gap-3"><div className="flex gap-0.5" aria-label={ratingSummary.count ? `${ratingSummary.average.toFixed(1)} out of 5 stars` : "No ratings yet"}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-4 w-4 ${ratingSummary.count && value <= Math.round(ratingSummary.average) ? "fill-current text-amber-300" : "text-slate-600"}`} />)}</div><strong className="text-lg text-white">{ratingSummary.count ? ratingSummary.average.toFixed(1) : "New"}</strong><span className="text-sm text-slate-400">{ratingSummary.count} {ratingSummary.count === 1 ? "review" : "reviews"}</span></div><p className="mt-2 text-xs text-slate-500">Based on feedback from accepted skill exchanges.</p></CardContent>
      </Card>
    </section>
    {profile.id !== user.id && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200/15 bg-cyan-300/[0.04] px-5 py-4"><div><strong className="text-white">Ready to start an exchange?</strong><p className="mt-1 text-sm text-slate-400">Send a request to see if your skills fit together.</p></div><SwapRequestAction profile={profile} matchContext={matchContext} /></div>}
    <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <Card>
        <CardHeader><CardTitle>Recent reviews</CardTitle></CardHeader>
        <CardContent>
          {reviewsQuery.isLoading && <p className="text-sm text-slate-400">Loading reviews...</p>}
          {reviewsQuery.isError && <div className="space-y-3"><p role="alert" className="text-sm text-rose-200">{reviewsQuery.error.message}</p><Button variant="outline" onClick={() => reviewsQuery.refetch()}>Try again</Button></div>}
          {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 && <div className="py-5 text-center"><Star className="mx-auto mb-2 h-5 w-5 text-cyan-200" /><h3 className="font-medium text-white">No reviews yet</h3><p className="mt-1 text-sm text-slate-400">Reviews from accepted exchanges will appear here.</p></div>}
          <div className="space-y-4">{reviews.slice(0, 5).map((review) => <article key={review.id} className="border-t border-white/10 pt-4 first:border-0 first:pt-0"><div className="flex items-center justify-between gap-3"><div><strong className="text-sm text-white">{review.reviewer?.name || "SkillSwap learner"}</strong><time className="ml-2 text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</time></div><span className="flex items-center gap-1 text-sm text-cyan-100"><Star className="h-3.5 w-3.5 fill-current" />{review.rating}/5</span></div><p className="mt-2 text-sm text-slate-300">{review.comment || "No written review."}</p></article>)}</div>
        </CardContent>
      </Card>
      {canReview && <Card>
        <CardHeader><CardTitle>Review your exchange</CardTitle><p className="text-sm text-slate-400">Share feedback from your accepted skill swap.</p></CardHeader>
        <CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submitReview.mutate(); }}>
          <fieldset><legend className="mb-2 text-sm font-medium text-slate-200">Your rating</legend><div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} onClick={() => setRating(value)} className="rounded p-1 text-cyan-200 hover:bg-white/10"><Star className={`h-6 w-6 ${value <= rating ? "fill-current" : ""}`} /></button>)}</div></fieldset>
          <div><label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-slate-200">Written review <span className="text-slate-500">(optional)</span></label><Textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={4} placeholder="How was your learning exchange?" /></div>
          <Button type="submit" disabled={submitReview.isPending}>{submitReview.isPending ? "Submitting..." : "Submit review"} <Star /></Button>
          {submitReview.isSuccess && <p role="status" className="text-sm text-emerald-200">Your review was submitted.</p>}
          {submitReview.isError && <p role="alert" className="text-sm text-rose-200">{submitReview.error.message || "Review could not be submitted. Check that this exchange is eligible and has not already been reviewed."}</p>}
        </form></CardContent>
      </Card>}
      {requestsQuery.isLoading && profile.id !== user.id && <Card><CardContent className="py-6 text-sm text-slate-400">Checking whether you can review this learner...</CardContent></Card>}
      {requestsQuery.isError && profile.id !== user.id && <Card><CardContent className="py-6 text-sm text-rose-200">Review eligibility could not be checked.</CardContent></Card>}
      {hasReviewedExchange && <Card><CardContent className="py-6 text-sm text-slate-300">You have already reviewed this accepted exchange.</CardContent></Card>}
    </section>
  </div></AppShell>;
}