type SwapRequest = {
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export function shouldShowSwapRequestAction(currentUserId: number | undefined, targetUserId: number) {
  return Boolean(currentUserId && currentUserId !== targetUserId);
}

export function getSwapRelationshipStatus(
  requests: SwapRequest[],
  currentUserId: number,
  targetUserId: number,
) {
  const relationshipRequests = requests.filter((request) => (
    (request.fromUserId === currentUserId && request.toUserId === targetUserId)
    || (request.fromUserId === targetUserId && request.toUserId === currentUserId)
  ));

  if (relationshipRequests.some((request) => request.status === "accepted")) return "accepted";
  if (relationshipRequests.some((request) => request.status === "pending")) return "pending";
  return relationshipRequests[0]?.status ?? null;
}

export function getSwapActionLabel(status: SwapRequest["status"] | null) {
  if (status === "pending") return "Request Pending";
  if (status === "accepted") return "Swap Accepted";
  if (status === "rejected") return "Send New Request";
  return "Send Swap Request";
}

export function formatSwapRequestError(message: unknown) {
  const normalized = typeof message === "string" ? message.toLowerCase() : "";

  if (normalized.includes("authentication required") || normalized.includes("unauthorized")) {
    return "Please log in to send a swap request.";
  }
  if (normalized.includes("recipient not found") || normalized.includes("user not found")) {
    return "This learner is no longer available.";
  }
  if (normalized.includes("active request") || normalized.includes("already pending")) {
    return "You already have a pending request with this learner.";
  }

  return "Unable to send the swap request. Please try again.";
}