// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Lives on branch prototype/knock-spike only. Do not merge.
import { readFileSync } from "node:fs";
import Knock, { signUserToken } from "@knocklabs/node";

// Node 18 has no process.loadEnvFile, and the dev server doesn't load .env.
function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {}
}
loadEnv();

export const WORKFLOWS = {
  discussionReply: "discussion-reply",
  newEnrollment: "new-enrollment",
} as const;

export const CATEGORIES = {
  discussions: "discussions",
  enrollments: "enrollments",
} as const;

export function knockConfig() {
  return {
    publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
  };
}

export const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });

export function knockUserId(userId: number) {
  return String(userId);
}

export function signFeedToken(userId: number) {
  return signUserToken(knockUserId(userId), { expiresInSeconds: 600 });
}
