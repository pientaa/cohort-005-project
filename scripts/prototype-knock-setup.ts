// PROTOTYPE — throwaway Knock spike setup. Uses the Management API (service token)
// to create + commit the two spike workflows and the environment-default preference
// that turns new Enrollment → Instructor off by default.
// Run: npx tsx scripts/prototype-knock-setup.ts
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const token = process.env.KNOCK_SERVICE_TOKEN;
const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
if (!token) throw new Error("KNOCK_SERVICE_TOKEN missing from .env");
const ENV = "development";
const BASE = "https://control.knock.app/v1";

async function mapi(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(`${method} ${path} → ${res.status}`);
  if (!res.ok) {
    console.log(text);
    throw new Error(`MAPI ${res.status}`);
  }
  return text ? JSON.parse(text) : null;
}

const channels = await mapi("GET", `/channels`);
const feed = channels.entries.find((c: any) => c.id === feedChannelId);
if (!feed) {
  console.log(channels.entries.map((c: any) => ({ id: c.id, key: c.key, type: c.type })));
  throw new Error("feed channel not found");
}
console.log("feed channel key:", feed.key);

// Workflow categories must exist in the preference category catalog first (MAPI 422 otherwise).
for (const [key, description] of [
  ["discussions", "Discussion questions and replies"],
  ["enrollments", "New Enrollments in an Instructor's course"],
]) {
  await mapi(
    "PUT",
    `/preference_categories/${key}?environment=${ENV}&commit=true&commit_message=${encodeURIComponent("prototype: knock spike")}`,
    { preference_category: { name: key, description } }
  );
}

const workflows = [
  {
    key: "discussion-reply",
    name: "Discussion Reply (prototype)",
    categories: ["discussions"],
    title: "{{ actor.name }} replied to your question",
    body: "**{{ actor.name }}** replied to your question in *{{ data.lesson_title }}* ({{ data.course_title }}).",
  },
  {
    key: "new-enrollment",
    name: "New Enrollment (prototype)",
    categories: ["enrollments"],
    title: "New student in {{ data.course_title }}",
    body: "**{{ actor.name }}** enrolled in *{{ data.course_title }}*.",
  },
];

for (const w of workflows) {
  await mapi(
    "PUT",
    `/workflows/${w.key}?environment=${ENV}&commit=true&commit_message=${encodeURIComponent("prototype: knock spike")}`,
    {
      workflow: {
        name: w.name,
        categories: w.categories,
        steps: [
          {
            type: "channel",
            ref: "in_app_feed_1",
            name: "In-app feed",
            channel_key: feed.key,
            template: { markdown_body: w.body, action_url: "{{ data.url }}" },
          },
        ],
      },
    }
  );
  const got = await mapi("GET", `/workflows/${w.key}?environment=${ENV}`);
  console.log(`  ${w.key}: categories=${JSON.stringify(got.categories)} active=${got.active} valid=${got.valid}`);
}

// Off-by-default, opt-in: new Enrollment → Instructor, in-app channel only (category × channel).
await mapi("PUT", `/environments/${ENV}/defaults`, {
  preference_set: {
    categories: { enrollments: { channel_types: { in_app_feed: false } } },
  },
});
console.log("env default:", JSON.stringify(await mapi("GET", `/environments/${ENV}/defaults`)));
