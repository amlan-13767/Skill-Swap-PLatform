import assert from "node:assert/strict";
import test from "node:test";

import { registrationSchema } from "./routes";
import { rankMatches } from "./matching";

test("registration accepts valid profile data", () => {
  const payload = {
    username: "valid_user_1",
    password: "StrongPassword1!",
    name: "Valid User",
    email: "valid.user@example.com",
    location: "Bhubaneswar",
    avatar: null,
    skillsOffered: ["Python", "SQL"],
    skillsWanted: ["React"],
    availability: ["weekdays"],
    isPublic: true,
  };

  const parsed = registrationSchema.parse(payload);
  assert.equal(parsed.email, "valid.user@example.com");
  assert.deepEqual(parsed.skillsOffered, ["Python", "SQL"]);
  assert.deepEqual(parsed.skillsWanted, ["React"]);
});

test("registration rejects invalid email addresses", () => {
  assert.throws(() => {
    registrationSchema.parse({
      username: "valid_user_2",
      password: "StrongPassword1!",
      name: "Valid User",
      email: "not-an-email",
      location: "Bhubaneswar",
      avatar: null,
      skillsOffered: ["Python"],
      skillsWanted: ["React"],
      availability: ["weekdays"],
      isPublic: true,
    });
  });
});

test("matching ranks reciprocal skill swaps above unrelated profiles", () => {
  const currentUser = {
    id: 1,
    username: "learner_one",
    name: "Learner One",
    email: "learner.one@example.com",
    location: "Bhubaneswar",
    avatar: null,
    skillsOffered: ["python", "sql"],
    skillsWanted: ["react"],
    availability: ["weekdays"],
    rating: 0,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const candidate = {
    id: 2,
    username: "mentor_two",
    name: "Mentor Two",
    email: "mentor.two@example.com",
    location: "Bhubaneswar",
    avatar: null,
    skillsOffered: ["react", "javascript"],
    skillsWanted: ["python", "sql"],
    availability: ["weekdays"],
    rating: 0,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const unrelated = {
    id: 3,
    username: "unrelated_user",
    name: "Unrelated User",
    email: "unrelated@example.com",
    location: "Cuttack",
    avatar: null,
    skillsOffered: ["cooking"],
    skillsWanted: ["drawing"],
    availability: ["weekends"],
    rating: 0,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const matches = rankMatches(currentUser, [unrelated, candidate]);
  assert.equal(matches[0].user.id, candidate.id);
  assert.ok(matches[0].compatibilityScore >= 70);
  assert.ok(matches[0].matchingSkills.includes("react"));
});
