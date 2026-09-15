import assert from "node:assert/strict";
import test from "node:test";
import { rankMatches } from "./matching";

const baseUser = {
  id: 1,
  username: "alex",
  name: "Alex",
  location: "Austin",
  avatar: null,
  skillsOffered: ["python"],
  skillsWanted: ["react"],
  availability: ["evenings"],
  rating: 45,
  isPublic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test("ranks mutual skill compatibility above unrelated profiles", () => {
  const compatible = { ...baseUser, id: 2, username: "sam", name: "Sam", skillsOffered: ["react"], skillsWanted: ["python"], availability: ["evenings"] };
  const unrelated = { ...baseUser, id: 3, username: "lee", name: "Lee", skillsOffered: ["guitar"], skillsWanted: ["cooking"], availability: ["weekends"] };
  const matches = rankMatches(baseUser, [unrelated, compatible]);

  assert.equal(matches[0].user.id, compatible.id);
  assert.equal(matches[0].compatibilityScore, 97);
  assert.deepEqual(matches[0].matchingSkills.sort(), ["python", "react"]);
});

test("does not return candidates with no compatibility", () => {
  const unrelated = { ...baseUser, id: 3, username: "lee", name: "Lee", skillsOffered: ["guitar"], skillsWanted: ["cooking"], availability: ["weekends"], rating: 0 };
  assert.deepEqual(rankMatches(baseUser, [unrelated]), []);
});