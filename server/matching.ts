import type { PublicUser } from "./storage";

type MatchResult = {
  user: PublicUser;
  compatibilityScore: number;
  matchingSkills: string[];
  reasons: string[];
};

function normalizedSkills(skills: string[] | null) {
  return new Set((skills ?? []).map((skill) => skill.trim().toLowerCase()));
}

export function rankMatches(currentUser: PublicUser, candidates: PublicUser[]): MatchResult[] {
  const wanted = normalizedSkills(currentUser.skillsWanted);
  const offered = normalizedSkills(currentUser.skillsOffered);

  return candidates.map((candidate) => {
    const candidateOffers = normalizedSkills(candidate.skillsOffered);
    const candidateWants = normalizedSkills(candidate.skillsWanted);
    const wantsFromCandidate = Array.from(wanted).filter((skill) => candidateOffers.has(skill));
    const offersToCandidate = Array.from(offered).filter((skill) => candidateWants.has(skill));
    const availabilityOverlap = (candidate.availability ?? []).some((value) => currentUser.availability.includes(value));
    const locationOverlap = Boolean(currentUser.location && candidate.location && currentUser.location.toLowerCase() === candidate.location.toLowerCase());
    const rawScore = Math.min(100, wantsFromCandidate.length * 40 + offersToCandidate.length * 40 + (availabilityOverlap ? 10 : 0) + (locationOverlap ? 5 : 0) + Math.round(candidate.rating / 20));
    const matchingSkills = Array.from(new Set([...wantsFromCandidate, ...offersToCandidate]));
    const reasons = [];
    if (wantsFromCandidate.length) reasons.push("They offer a skill you want");
    if (offersToCandidate.length) reasons.push("You offer a skill they want");
    if (availabilityOverlap) reasons.push("Availability overlaps");
    if (locationOverlap) reasons.push("Location matches");
    return { user: candidate, compatibilityScore: rawScore, matchingSkills, reasons };
  }).filter((match) => match.matchingSkills.length > 0).sort((left, right) => right.compatibilityScore - left.compatibilityScore);
}