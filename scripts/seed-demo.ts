import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseSchema } from "../server/db";
import { swapRequests, users } from "../shared/schema";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "SkillSwapDemo123!";
const CLEAR_ONLY = process.argv.includes("--clear");

const skillCatalog = {
  programming: [
    "Python",
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "Java",
    "C",
    "C++",
    "SQL",
    "PostgreSQL",
    "MongoDB",
    "Git",
    "Docker",
  ],
  data: [
    "Data Science",
    "Machine Learning",
    "Deep Learning",
    "Pandas",
    "NumPy",
    "Power BI",
    "Tableau",
    "Excel",
  ],
  design: [
    "UI/UX",
    "Figma",
    "Graphic Design",
    "Photoshop",
    "Illustration",
    "Canva",
  ],
  creative: [
    "Photography",
    "Video Editing",
    "Music Production",
    "Guitar",
    "Piano",
    "Drawing",
  ],
  languages: [
    "English",
    "Hindi",
    "Bengali",
    "Spanish",
    "French",
    "Japanese",
  ],
  other: [
    "Public Speaking",
    "Content Writing",
    "Digital Marketing",
    "SEO",
    "Cooking",
    "Fitness",
    "Yoga",
  ],
};

const demoUsers = [
  { username: "demo.aarav", name: "Aarav Sharma", email: "demo.aarav@skillswap.local", location: "Bhubaneswar", offered: ["Python", "SQL", "Git"], wanted: ["React", "JavaScript"], availability: ["weekdays", "evenings"], isPublic: true },
  { username: "demo.riya", name: "Riya Sen", email: "demo.riya@skillswap.local", location: "Bhubaneswar", offered: ["React", "JavaScript", "UI/UX"], wanted: ["Python", "SQL"], availability: ["weekdays", "flexible"], isPublic: true },
  { username: "demo.aditya", name: "Aditya Rao", email: "demo.aditya@skillswap.local", location: "Hyderabad", offered: ["Java", "Spring Boot", "SQL"], wanted: ["React", "Docker"], availability: ["weekends"], isPublic: true },
  { username: "demo.neha", name: "Neha Patil", email: "demo.neha@skillswap.local", location: "Pune", offered: ["Machine Learning", "Python", "Pandas"], wanted: ["Figma", "UI/UX"], availability: ["evenings"], isPublic: true },
  { username: "demo.kunal", name: "Kunal Das", email: "demo.kunal@skillswap.local", location: "Kolkata", offered: ["Figma", "Graphic Design", "Illustration"], wanted: ["Python", "Data Science"], availability: ["weekdays"], isPublic: true },
  { username: "demo.sana", name: "Sana Khan", email: "demo.sana@skillswap.local", location: "Delhi", offered: ["Public Speaking", "Content Writing", "SEO"], wanted: ["French", "English"], availability: ["weekends", "evenings"], isPublic: true },
  { username: "demo.vikram", name: "Vikram Iyer", email: "demo.vikram@skillswap.local", location: "Bengaluru", offered: ["Photography", "Video Editing", "Photoshop"], wanted: ["Python", "Machine Learning"], availability: ["flexible"], isPublic: true },
  { username: "demo.mira", name: "Mira Nair", email: "demo.mira@skillswap.local", location: "Kochi", offered: ["Guitar", "Music Production", "Piano"], wanted: ["Content Writing", "Public Speaking"], availability: ["weekends", "evenings"], isPublic: true },
  { username: "demo.arjun", name: "Arjun Malik", email: "demo.arjun@skillswap.local", location: "Jaipur", offered: ["JavaScript", "React", "Docker"], wanted: ["French", "Spanish"], availability: ["weekdays", "weekends"], isPublic: true },
  { username: "demo.isha", name: "Isha Roy", email: "demo.isha@skillswap.local", location: "Lucknow", offered: ["Yoga", "Fitness", "Public Speaking"], wanted: ["Photography", "Video Editing"], availability: ["weekends", "evenings"], isPublic: true },
  { username: "demo.yash", name: "Yash Gupta", email: "demo.yash@skillswap.local", location: "Noida", offered: ["TypeScript", "Node.js", "React"], wanted: ["SQL", "PostgreSQL"], availability: ["weekdays"], isPublic: true },
  { username: "demo.meera", name: "Meera Joshi", email: "demo.meera@skillswap.local", location: "Ahmedabad", offered: ["Excel", "Power BI", "Data Science"], wanted: ["JavaScript", "React"], availability: ["evenings"], isPublic: true },
  { username: "demo.siddh", name: "Siddharth Patra", email: "demo.siddh@skillswap.local", location: "Cuttack", offered: ["C++", "C", "Git"], wanted: ["JavaScript", "Node.js"], availability: ["weekends"], isPublic: true },
  { username: "demo.ananya", name: "Ananya Ghosh", email: "demo.ananya@skillswap.local", location: "Bhubaneswar", offered: ["Canva", "Graphic Design", "Illustration"], wanted: ["Python", "Machine Learning"], availability: ["weekdays", "evenings"], isPublic: true },
  { username: "demo.tanvi", name: "Tanvi Bansal", email: "demo.tanvi@skillswap.local", location: "Mumbai", offered: ["Digital Marketing", "SEO", "Content Writing"], wanted: ["Photography", "Video Editing"], availability: ["weekends"], isPublic: true },
  { username: "demo.rahul", name: "Rahul Singh", email: "demo.rahul@skillswap.local", location: "Nagpur", offered: ["MongoDB", "SQL", "Node.js"], wanted: ["React", "TypeScript"], availability: ["weekdays", "evenings"], isPublic: true },
  { username: "demo.pooja", name: "Pooja Verma", email: "demo.pooja@skillswap.local", location: "Indore", offered: ["Drawing", "Illustration", "Canva"], wanted: ["Public Speaking", "Content Writing"], availability: ["weekends", "flexible"], isPublic: true },
  { username: "demo.nitin", name: "Nitin Sahu", email: "demo.nitin@skillswap.local", location: "Raipur", offered: ["PostgreSQL", "SQL", "Docker"], wanted: ["Figma", "UI/UX"], availability: ["weekdays"], isPublic: true },
  { username: "demo.kavya", name: "Kavya Menon", email: "demo.kavya@skillswap.local", location: "Thiruvananthapuram", offered: ["English", "French", "Spanish"], wanted: ["Python", "JavaScript"], availability: ["evenings", "weekends"], isPublic: true },
  { username: "demo.aman", name: "Aman Choudhury", email: "demo.aman@skillswap.local", location: "Guwahati", offered: ["JavaScript", "TypeScript", "Git"], wanted: ["Machine Learning", "Data Science"], availability: ["weekdays", "flexible"], isPublic: true },
  { username: "demo.juhi", name: "Juhi Patel", email: "demo.juhi@skillswap.local", location: "Vadodara", offered: ["Power BI", "Excel", "Tableau"], wanted: ["Photography", "Video Editing"], availability: ["weekends"], isPublic: true },
  { username: "demo.ankit", name: "Ankit Mishra", email: "demo.ankit@skillswap.local", location: "Patna", offered: ["Java", "C++", "SQL"], wanted: ["React", "UI/UX"], availability: ["weekdays"] , isPublic: true },
  { username: "demo.priya", name: "Priya Nanda", email: "demo.priya@skillswap.local", location: "Srinagar", offered: ["Yoga", "Fitness", "Cooking"], wanted: ["Public Speaking", "English"], availability: ["weekends", "evenings"], isPublic: true },
  { username: "demo.rohan", name: "Rohan Das", email: "demo.rohan@skillswap.local", location: "Ranchi", offered: ["React", "JavaScript", "Figma"], wanted: ["SQL", "Python"], availability: ["flexible"], isPublic: true },
  { username: "demo.zoya", name: "Zoya Ali", email: "demo.zoya@skillswap.local", location: "Chennai", offered: ["Content Writing", "SEO", "Digital Marketing"], wanted: ["Graphic Design", "Canva"], availability: ["weekends"], isPublic: true },
  { username: "demo.hitesh", name: "Hitesh Sharma", email: "demo.hitesh@skillswap.local", location: "Gurugram", offered: ["Node.js", "PostgreSQL", "MongoDB"], wanted: ["Java", "Docker"], availability: ["weekdays", "evenings"], isPublic: true },
  { username: "demo.mitali", name: "Mitali Bose", email: "demo.mitali@skillswap.local", location: "Siliguri", offered: ["Music Production", "Guitar", "Piano"], wanted: ["Photography", "Video Editing"], availability: ["weekends", "flexible"], isPublic: true },
  { username: "demo.akash", name: "Akash Sharma", email: "demo.akash@skillswap.local", location: "Jabalpur", offered: ["Java", "Docker", "Git"], wanted: ["Python", "Machine Learning"], availability: ["weekdays"], isPublic: true },
  { username: "demo.divya", name: "Divya Sen", email: "demo.divya@skillswap.local", location: "Coimbatore", offered: ["UI/UX", "Figma", "Photoshop"], wanted: ["SEO", "Digital Marketing"], availability: ["evenings", "weekends"], isPublic: true },
];

const normalizeAvailability = (value: string[]) => value.filter((entry) => ["weekdays", "weekends", "evenings", "flexible"].includes(entry));

async function clearData() {
  await db.delete(swapRequests);
  await db.delete(users);
  console.log("Cleared demo users and swap requests.");
}

async function seedDemoUsers() {
  const seedRecords = await Promise.all(demoUsers.map(async (user) => ({
    username: user.username,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    name: user.name,
    email: user.email,
    location: user.location,
    avatar: null,
    skillsOffered: user.offered,
    skillsWanted: user.wanted,
    availability: normalizeAvailability(user.availability),
    isPublic: user.isPublic,
  })));

  await db.insert(users).values(seedRecords);
  console.log(`Created ${seedRecords.length} demo users.`);

  const rows = await db.select().from(users).where(eq(users.email, demoUsers[0].email));
  console.log(`Database check: ${rows.length} records inserted.`);
}

async function seedDemoSwaps() {
  const firstUser = await db.query.users.findFirst({ where: eq(users.email, "demo.aarav@skillswap.local") });
  const secondUser = await db.query.users.findFirst({ where: eq(users.email, "demo.riya@skillswap.local") });
  const thirdUser = await db.query.users.findFirst({ where: eq(users.email, "demo.neha@skillswap.local") });
  const fourthUser = await db.query.users.findFirst({ where: eq(users.email, "demo.kunal@skillswap.local") });

  const records = [
    { fromUserId: firstUser!.id, toUserId: secondUser!.id, status: "pending", message: "Would love to swap Python for React mentoring." },
    { fromUserId: secondUser!.id, toUserId: firstUser!.id, status: "accepted", message: "Happy to share React practice sessions." },
    { fromUserId: thirdUser!.id, toUserId: fourthUser!.id, status: "rejected", message: "I can help with design skills, but timing does not match." },
    { fromUserId: fourthUser!.id, toUserId: firstUser!.id, status: "cancelled", message: "Cancelled due to schedule conflict." },
  ] as const;

  await db.insert(swapRequests).values(records);
  console.log(`Created ${records.length} demo swap requests.`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo data seeding is disabled in production. Use a local development database only.");
  }

  await ensureDatabaseSchema();

  if (CLEAR_ONLY) {
    await clearData();
    return;
  }

  await seedDemoUsers();
  await seedDemoSwaps();
  console.log("Development demo data is ready.");
  console.log(`Demo password is set to: ${DEMO_PASSWORD}`);
  console.log("This is for local development only. Never use these accounts in production.");
}

main().catch((error: Error) => {
  console.error("Demo seeding failed:", error);
  process.exitCode = 1;
});
