import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import { Link } from "wouter";
import SwapRequestAction from "@/components/SwapRequestAction";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

function SkillGroup({ label, skills, color }) {
  return <div className="min-w-0">
    <span className="eyebrow">{label}</span>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {skills?.length ? skills.map((skill) => <Badge className={`skill-pill ${color}`} key={`${label}-${skill}`}>{skill}</Badge>) : <span className="text-sm text-slate-500">No skills listed</span>}
    </div>
  </div>;
}

export default function Matches() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["/api/matches"],
    queryFn: async () => {
      const response = await fetch("/api/matches", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load your learning matches.");
      return response.json();
    },
  });
  const matches = query.data?.matches ?? [];

  return <AppShell pageLabel="Matches">
    <div className="shell app-page">
      <div className="page-heading-row">
        <div><span className="eyebrow text-cyan-300">Personalized for you</span><h1>Your learning<br /><span className="heading-gradient">matches.</span></h1><p>See what you can teach each other and what makes the connection a fit.</p></div>
        <Link href="/profile"><Button variant="outline">Tune your profile <ArrowRight /></Button></Link>
      </div>
      {query.isLoading && <div className="app-card-grid" aria-label="Loading matches">{[1, 2].map((item) => <div className="dashboard-skeleton match-skeleton" key={item} />)}</div>}
      {query.isError && <div className="app-empty"><Sparkles /><h2>Matches are taking a moment</h2><p>We couldn't load your recommendations just now.</p><Button onClick={() => query.refetch()}>Try again</Button></div>}
      {!query.isLoading && !query.isError && matches.length === 0 && <div className="app-empty"><Compass /><h2>No matches yet</h2><p>Add skills you can teach and want to learn, or browse the community while new matches take shape.</p><div className="flex flex-wrap justify-center gap-2"><Link href="/profile"><Button>Edit profile</Button></Link><Link href="/browse"><Button variant="outline">Browse learners <ArrowRight /></Button></Link></div></div>}
      {!query.isLoading && !query.isError && matches.length > 0 && <div className="match-card-grid">
        {matches.map((match) => {
          const profileHref = `/profile?user=${match.user.id}&matchScore=${match.compatibilityScore}&matchSkills=${encodeURIComponent(match.matchingSkills.join(","))}`;
          return <Card className="match-card" key={match.user.id}><CardContent className="p-6">
            <div className="match-card-head">
              <div className="flex min-w-0 items-center gap-3">
                {match.user.avatar ? <img className="app-card-avatar" src={match.user.avatar} alt={match.user.name} /> : <span className="app-card-avatar grid shrink-0 place-items-center bg-cyan-300/10 font-semibold text-cyan-100" aria-hidden="true">{match.user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>}
                <div className="min-w-0"><h2 className="truncate">{match.user.name}</h2><span className="user-meta">{match.user.location || "Location not provided"}</span><span className="mt-1 block text-xs capitalize text-slate-400">{match.user.availability?.join(", ") || "Flexible"}</span></div>
              </div>
              <div className="match-score-chip"><strong>{match.compatibilityScore}%</strong><span>match</span></div>
            </div>
            <div className="match-exchange">
              <SkillGroup label="They can teach you" skills={match.user.skillsOffered} color="skill-pill-blue" />
              <ArrowRight className="match-exchange-arrow" aria-hidden="true" />
              <SkillGroup label="You can teach them" skills={match.user.skillsWanted} color="skill-pill-green" />
            </div>
            <div className="match-reasons"><span className="eyebrow">Why this match</span>{match.reasons.length ? match.reasons.map((reason) => <p key={reason}><Check /> {reason}</p>) : <p><Check /> Your skills have room to complement each other.</p>}</div>
            <div className="match-card-footer flex flex-wrap items-center gap-2">
              <Link href={profileHref}><Button variant="outline">View profile <ArrowRight /></Button></Link>
              <SwapRequestAction profile={match.user} matchContext={{ score: match.compatibilityScore, skills: match.matchingSkills }} />
            </div>
          </CardContent></Card>;
        })}
      </div>}
    </div>
  </AppShell>;
}
