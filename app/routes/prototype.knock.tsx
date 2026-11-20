// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Branch prototype/knock-spike only. Do not merge.
// Open /prototype/knock, switch users in the DevUI panel, click through the four checks.
import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import { comments, courses, enrollments, lessons, modules, users } from "~/db/schema";
import { requireUserId } from "~/lib/access.server";
import {
  CATEGORIES,
  WORKFLOWS,
  knock,
  knockConfig,
  knockUserId,
  signFeedToken,
} from "~/lib/prototype-knock.server";

function getUser(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get()!;
}

async function identify(id: number) {
  const u = getUser(id);
  await knock.users.update(knockUserId(u.id), { name: u.name, email: u.email });
  return u;
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const user = await identify(userId);
  const token = await signFeedToken(userId);
  const prefs = await knock.users.getPreferences(knockUserId(userId), "default").catch((e) => ({ error: String(e) }));
  return {
    user: { id: user.id, name: user.name, role: user.role },
    knockUserId: knockUserId(userId),
    token,
    prefs,
    ...knockConfig(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const me = await identify(userId);

  if (intent === "trigger-reply") {
    // Discussion Reply → question author. Use one of my real questions if I have one.
    const q = db
      .select({ id: comments.id, lessonId: lessons.id, lessonTitle: lessons.title, courseTitle: courses.title, slug: courses.slug })
      .from(comments)
      .innerJoin(lessons, eq(lessons.id, comments.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(eq(comments.userId, userId), isNull(comments.parentId)))
      .get();
    const lesson =
      q ??
      db
        .select({ id: lessons.id, lessonId: lessons.id, lessonTitle: lessons.title, courseTitle: courses.title, slug: courses.slug })
        .from(lessons)
        .innerJoin(modules, eq(modules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, modules.courseId))
        .get()!;
    const actor = await identify(db.select().from(users).where(ne(users.id, userId)).get()!.id);
    const res = await knock.workflows.trigger(WORKFLOWS.discussionReply, {
      recipients: [knockUserId(userId)],
      actor: knockUserId(actor.id),
      data: {
        lesson_title: lesson.lessonTitle,
        course_title: lesson.courseTitle,
        url: `/courses/${lesson.slug}/lessons/${lesson.lessonId}`,
        real_question: Boolean(q),
      },
    });
    return { intent, result: res };
  }

  if (intent === "trigger-enrollment") {
    // new Enrollment → Instructor. Use one of my courses + a real enrolled student if possible.
    const course = db.select().from(courses).where(eq(courses.instructorId, userId)).get() ?? db.select().from(courses).get()!;
    const enrolled = db.select().from(enrollments).where(and(eq(enrollments.courseId, course.id), ne(enrollments.userId, userId))).get();
    const studentId = enrolled?.userId ?? db.select().from(users).where(ne(users.id, userId)).get()!.id;
    const actor = await identify(studentId);
    const res = await knock.workflows.trigger(WORKFLOWS.newEnrollment, {
      recipients: [knockUserId(userId)],
      actor: knockUserId(actor.id),
      data: { course_title: course.title, url: `/instructor/${course.id}/students` },
    });
    return { intent, result: res };
  }

  if (intent === "opt-in" || intent === "opt-out") {
    const res = await knock.users.setPreferences(knockUserId(userId), "default", {
      __persistence_strategy__: "merge",
      categories: { [CATEGORIES.enrollments]: { channel_types: { in_app_feed: intent === "opt-in" } } },
    });
    return { intent, result: res };
  }

  if (intent === "reset-prefs") {
    await knock.users.unsetPreferences(knockUserId(userId), "default");
    return { intent, result: "unset" };
  }

  return { intent, result: `unknown intent for ${me.name}` };
}

type FeedItem = { id: string; read_at: string | null; seen_at: string | null; source: { key: string; categories: string[] }; blocks: { name: string; rendered: string }[]; inserted_at: string };
type Feed = { entries: FeedItem[]; meta: { unread_count: number; unseen_count: number; total_count: number } };

export default function PrototypeKnock({ loaderData }: Route.ComponentProps) {
  const { user, knockUserId, token, publicKey, feedChannelId, prefs } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l].slice(0, 40));

  // Everything below runs in the BROWSER with the public key + server-signed user token.
  const knockFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`https://api.knock.app/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${publicKey}`,
          "X-Knock-User-Token": token,
          "Content-Type": "application/json",
        },
      });
      const body = await res.text();
      push(`${init?.method ?? "GET"} ${path} → ${res.status}${res.ok ? "" : ` ${body}`}`);
      return res.ok && body ? JSON.parse(body) : null;
    },
    [publicKey, token]
  );

  const loadFeed = useCallback(async () => {
    setFeed(await knockFetch(`/users/${knockUserId}/feeds/${feedChannelId}?page_size=20`));
  }, [knockFetch, knockUserId, feedChannelId]);

  useEffect(() => {
    setFeed(null);
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (fetcher.data) {
      push(`server ${fetcher.data.intent}: ${JSON.stringify(fetcher.data.result).slice(0, 300)}`);
      setTimeout(loadFeed, 2500); // Knock processes workflows async
    }
  }, [fetcher.data, loadFeed]);

  const batch = async (status: "read" | "seen" | "unread" | "unseen", ids: string[]) => {
    if (ids.length) await knockFetch(`/messages/batch/${status}`, { method: "POST", body: JSON.stringify({ message_ids: ids }) });
    await loadFeed();
  };

  const tokenClaims = JSON.parse(atob(token.split(".")[1]));
  const ids = feed?.entries.map((e) => e.id) ?? [];
  const btn = "rounded border px-3 py-1 text-sm hover:bg-muted";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 font-mono text-sm">
      <div className="rounded border-2 border-dashed border-amber-500 p-3">PROTOTYPE — Knock spike. Throwaway.</div>

      <section>
        <h2 className="font-bold">1. Signed user token</h2>
        <div>DevUI user: {user.name} (#{user.id}, {user.role}) → Knock user id "{knockUserId}"</div>
        <div>token claims: {JSON.stringify(tokenClaims)}</div>
        <div>header alg: {JSON.parse(atob(token.split(".")[0])).alg}</div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">2. Trigger (Node SDK, server)</h2>
        <fetcher.Form method="post" className="flex gap-2">
          <button className={btn} name="intent" value="trigger-reply">Discussion Reply → me</button>
          <button className={btn} name="intent" value="trigger-enrollment">new Enrollment → me (as Instructor)</button>
        </fetcher.Form>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">3. Headless feed (browser, public key + token)</h2>
        <div>
          unread {feed?.meta.unread_count ?? "?"} · unseen {feed?.meta.unseen_count ?? "?"} · total {feed?.meta.total_count ?? "?"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={loadFeed}>reload</button>
          <button className={btn} onClick={() => batch("seen", ids)}>mark all seen</button>
          <button className={btn} onClick={() => batch("read", ids)}>mark all read</button>
          <button className={btn} onClick={() => batch("unread", ids)}>mark all unread</button>
        </div>
        <ul className="space-y-1">
          {feed?.entries.map((e) => (
            <li key={e.id} className={`rounded border p-2 ${e.read_at ? "opacity-60" : ""}`}>
              <div className="text-xs">
                {e.source.key} [{e.source.categories.join(",")}] · seen={String(!!e.seen_at)} read={String(!!e.read_at)} · {e.inserted_at}
              </div>
              <div dangerouslySetInnerHTML={{ __html: e.blocks[0]?.rendered ?? "" }} />
              <button className={btn} onClick={() => batch(e.read_at ? "unread" : "read", [e.id])}>
                toggle read
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">4. Preferences (category × channel)</h2>
        <fetcher.Form method="post" className="flex gap-2">
          <button className={btn} name="intent" value="opt-in">opt in: enrollments × in_app_feed</button>
          <button className={btn} name="intent" value="opt-out">opt out</button>
          <button className={btn} name="intent" value="reset-prefs">unset my prefs (env default)</button>
        </fetcher.Form>
        <pre className="overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(prefs, null, 2)}</pre>
      </section>

      <section>
        <h2 className="font-bold">Log</h2>
        <pre className="overflow-auto rounded bg-muted p-2 text-xs">{log.join("\n")}</pre>
      </section>
    </div>
  );
}
