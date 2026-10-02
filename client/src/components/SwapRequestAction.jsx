import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatSwapRequestError, getSwapActionLabel, getSwapRelationshipStatus, shouldShowSwapRequestAction } from "@/lib/swapRequests";
import { apiRequest } from "@/lib/queryClient";

function SkillList({ label, skills, color }) {
  return <div className="space-y-2">
    <p className="text-sm font-medium text-slate-200">{label}</p>
    <div className="flex flex-wrap gap-2">
      {skills?.length ? skills.map((skill) => <Badge key={`${label}-${skill}`} className={`skill-pill ${color}`}>{skill}</Badge>) : <span className="text-sm text-slate-400">Not listed</span>}
    </div>
  </div>;
}

export default function SwapRequestAction({ profile, matchContext }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const requestsQuery = useQuery({
    queryKey: ["/api/swap-requests"],
    enabled: Boolean(user && profile?.id !== user.id),
    queryFn: async () => {
      const response = await fetch("/api/swap-requests", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to check request status.");
      return response.json();
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/swap-requests", { toUserId: profile.id, message: message.trim() || undefined });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/swap-requests"] });
      setOpen(false);
      setMessage("");
      toast({ title: "Swap request sent", description: `Your request to ${profile.name} is pending.` });
    },
  });

  if (!shouldShowSwapRequestAction(user?.id, profile?.id)) return null;

  const requestStatus = getSwapRelationshipStatus(requestsQuery.data?.requests ?? [], user.id, profile.id);
  const label = getSwapActionLabel(requestStatus);

  if (requestsQuery.isError) {
    return <div className="flex flex-wrap items-center gap-2">
      <Button type="button" disabled variant="outline">Request status unavailable</Button>
      <button type="button" className="text-sm text-cyan-200 underline underline-offset-4" onClick={() => requestsQuery.refetch()}>Retry</button>
    </div>;
  }

  return <>
    <Button type="button" disabled={requestsQuery.isLoading || mutation.isPending || requestStatus === "pending" || requestStatus === "accepted"} onClick={() => setOpen(true)}>
      {requestStatus === "pending" ? <Clock3 /> : requestStatus === "accepted" ? <Check /> : <Send />}
      {requestsQuery.isLoading ? "Checking requests..." : label}
    </Button>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!mutation.isPending) setOpen(nextOpen); }}>
      <DialogContent className="dark-dialog max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Send Skill Swap Request</DialogTitle>
          <DialogDescription className="text-slate-300">You are requesting a skill exchange with {profile.name}.</DialogDescription>
        </DialogHeader>
        {matchContext && <div className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3">
          <p className="font-semibold text-cyan-100">{matchContext.score}% match</p>
          {matchContext.skills.length > 0 && <p className="mt-1 text-sm text-slate-300">Shared goals: {matchContext.skills.join(", ")}</p>}
        </div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <SkillList label="They can teach" skills={profile.skillsOffered} color="skill-pill-blue" />
          <SkillList label="You can teach" skills={user.skillsOffered} color="skill-pill-green" />
          <SkillList label="You want to learn" skills={user.skillsWanted} color="skill-pill-green" />
          <SkillList label="They want to learn" skills={profile.skillsWanted} color="skill-pill-blue" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="swap-request-message">Message (optional)</Label>
          <Textarea id="swap-request-message" maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What would you like to exchange?" />
        </div>
        {mutation.isError && <p role="alert" className="text-sm font-medium text-rose-300">{formatSwapRequestError(mutation.error?.message)}</p>}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Sending request..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}