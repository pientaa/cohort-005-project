# Hosted notification vendors for Cadence

Resolves [#3](https://github.com/pientaa/cohort-005-project/issues/3): which hosted notification vendors meet Cadence's production constraints?

All sources are first-party (vendor pricing, docs, legal and trust pages), accessed **2026-11-19** unless noted. Vendor pricing pages change often, so re-check them before signing anything.

## Answer

**Try Novu Cloud first, then Courier.** Both host data in the EU and publish a DPA and SOC 2 Type II. Both cost tens to a few hundred USD per month at Cadence's scale, and both send email through an existing Postmark account. Knock has the most polished React feed, but it is **US-hosted only** (EU residency is promised "by the end of 2026"), so it passes only on the DPA route. SuprSend passes on paper, but its EU region and plan details are vague. MagicBell drops out: it has no Postmark support, no stated EU hosting, and its security page does not mention SOC 2.

## Scale assumption

The docs give no basis for a different number, so I assume **~10k monthly active recipients**, each receiving ~5–8 notifications a month. That is **~50k–80k messages or workflow runs per month**. Vendors meter different units (messages, deliveries, sends, workflow runs), so the cost estimates below are approximate.

## Hard constraints

| Vendor | EU data residency | DPA | SOC 2 | Est. cost at ~50–80k/mo | Verdict |
|---|---|---|---|---|---|
| **Novu Cloud** | Yes, Frankfurt, **all plans** (`eu.api.novu.co`) [N1] | Downloadable DPA + SCC template [N1] | Type II, report in trust centre [N1] | Pro "from $30" + $1.20/1k runs, about $60–$90. Team "from $250" (250k runs) [N2] | **Pass** |
| **Courier** | Yes, Ireland, **Business + Enterprise** (`api.eu.courier.com`) [C1] | DPA listed for Enterprise ("MSA, DPA, BAA & legal review") [C2]; compliance docs link a DPA [C3] | Type II [C3] | Business is pay-per-send at $0.005, so about **$250–$400** [C2] | **Pass** (DPA for Business tier to confirm) |
| **Knock** | **No.** Docs: "We expect to support EU data residency by the end of 2026" [K1] | Yes. The DPA forms part of the ToS, with a subprocessor list [K2][K3] | Type II, report at trust.knock.app [K1] | Starter $250/mo includes 50k messages, then $0.005 each, so about **$250–$400** [K4] | **Pass on DPA only.** EU data goes to the US under SCCs |
| **SuprSend** | Stated: "support[s] EU-data residency options" and "US or EU data residency". Region and plan not given [S1][S2] | DPA applies to EEA/UK/CH data [S3] | Type II + ISO 27001 [S1]. Report on Essentials and above [S4] | Essentials $100/mo (annual, 50k notifications); **Business $250/mo needed for preferences** [S4] | **Pass, but unverified details** |
| **MagicBell** | Not stated anywhere [M1][M2] | "We provide data processing agreements" [M1] | Not on the security page [M1]. Only an undated community blog claims Type II [M3] | Startup $249/mo for 50k deliveries, then $0.0025 each [M2] | **Fail in practice.** No EU hosting, SOC 2 unconfirmed, no Postmark (see below) |

## Feature fit for vendors that pass

| | Novu Cloud | Courier | Knock | SuprSend |
|---|---|---|---|---|
| **React feed, prebuilt** | `<Inbox />` in `@novu/react` [N3] | `CourierInbox`, `CourierInboxPopupMenu` in `@trycourier/courier-react` [C4] | `NotificationFeedPopover`, `NotificationIconButton`, `NotificationFeed` in `@knocklabs/react` [K5] | `Inbox` in `@suprsend/react` [S5] |
| **Headless** | Hooks `useNotifications`, `useCounts`, `useNovu`, all real-time [N4] | `useCourier()` hook, fully headless [C5] | Headless feed and preferences hooks (`useNotifications`, etc.) [K5][K6] | `@suprsend/react-core` (headless) [S5] |
| **Tailwind/shadcn theming** | **Best fit.** `appearance.elements` accepts Tailwind class strings or callbacks that return classes, plus `variables` and a dark `baseTheme` [N5] | `CourierInboxTheme` object (merged with `defaultLightTheme`) plus render props. JS theme object, not classes [C5] | `--rnf-` CSS variables, `rnf-` classes, `colorMode` for dark mode, `renderItem`/`renderHeader` [K5] | `theme` prop of CSS-style objects, replaceable sub-components [S5] |
| **Web push** | Through FCM (web), OneSignal or Pushpad integrations [N6] | Through OneSignal (recommended for browser) or FCM [C6] | No first-party channel. Docs say to use FCM [K7] | Native "Send Web Push" workflow node [S6] |
| **Postmark (own account)** | Yes, server API token [N7] | Yes, plus per-message `MessageStream` override and Postmark templates [C7] | Yes, delivery webhooks, `MessageStream` via override [K8] | Yes, server token, delivery webhooks [S7] |
| **Preference centre** | Built into Inbox, with subscriber and workflow preferences [N8] | Hosted preference page, embeddable [C8] | Prebuilt React `PreferenceCenter`, hosted page, headless hook [K6] | Hosted preference page, **Business plan only** [S4][S7] |
| **Node server SDK** | `@novu/api`, with `serverURL: "https://eu.api.novu.co"` [N9] | Node SDK with `baseURL`/`COURIER_BASE_URL` for EU [C1] | `@knocklabs/node` [K9] | Node SDK listed among backend SDKs [S8] |

MagicBell is left out of this table. Its email channel lists only SendGrid, Ping Email, Mailgun, SMTP and Amazon SES, so it has **no Postmark** support [M4].

## Ranked shortlist

1. **Novu Cloud.** It is the only vendor with **EU hosting on every plan**, including the cheapest. The DPA and SCCs can be downloaded without a sales call, SOC 2 Type II is in place, and it is probably the cheapest at this scale (Pro, about $60–$90/mo). Its Inbox theming takes Tailwind classes directly, so it fits a shadcn UI with little effort. Headless hooks are a fallback if needed. Postmark and a Node SDK are both supported. *Weak spot:* web push needs an extra provider (FCM, OneSignal or Pushpad). Regional API keys mean you must create the account in the EU dashboard (`eu.dashboard.novu.co`) from day one [N1].
2. **Courier.** It has an EU datacenter (Ireland) on the self-serve Business tier and SOC 2 Type II. It has the deepest Postmark integration (message streams, Postmark templates, failover routing). It offers both a headless hook and a prebuilt inbox. *Weak spots:* pay-per-send pricing ($250–$400/mo) costs more and is less predictable. Theming is a JS theme object rather than Tailwind classes. The EU workspace is set up separately from the US one, and the SDKs default to the US [C1]. Before relying on it, confirm that the Business tier comes with a signed DPA.

**Not shortlisted:**
- **Knock** has the best React feed and preferences UX, but it has no EU residency until its promised late-2026 launch. Revisit if Cadence accepts US hosting under a DPA, or once the EU region ships.
- **SuprSend** has unclear EU region and plan terms, and preferences require the $250 Business tier.
- **MagicBell** has no Postmark support, no EU hosting and no confirmed SOC 2.

## Open questions for the hands-on trial

- Novu: does one trigger fanning out to in-app, email and push count as one workflow run? This determines whether Pro or Team is the right plan [N2].
- Courier: does each in-app inbox message count as a billable send alongside email? Is a DPA countersigned on Business?
- Confirm that each vendor's subprocessors (email/push relays, logging) also stay in the EU for an EU workspace.

## Sources

**Novu**
- [N1] Security and Compliance (data residency, SOC 2, DPA): https://docs.novu.co/platform/additional-resources/security.md
- [N2] Pricing: https://novu.co/pricing
- [N3] Inbox overview: https://docs.novu.co/platform/inbox.md
- [N4] Headless mode: https://docs.novu.co/platform/inbox/headless-mode.md
- [N5] Styling and theming: https://docs.novu.co/platform/inbox/configuration/styling.md
- [N6] Push integrations: https://docs.novu.co/platform/integrations/push.md
- [N7] Postmark: https://docs.novu.co/platform/integrations/email/postmark.md
- [N8] Inbox preferences: https://docs.novu.co/platform/inbox/configuration/preferences.md
- [N9] TypeScript server SDK: https://docs.novu.co/platform/sdks/server/typescript.md

**Courier**
- [C1] Datacenters (EU, Ireland, Business+): https://www.courier.com/docs/workspaces/datacenters
- [C2] Pricing: https://www.courier.com/pricing
- [C3] Compliance: https://www.courier.com/docs/workspaces/compliance
- [C4] Add the Courier Inbox: https://www.courier.com/docs/in-app/add-an-inbox
- [C5] New Courier Inbox for Web (theme object, `useCourier`): https://www.courier.com/blog/the-new-courier-inbox-for-web-faster-more-flexible-in-app-notifications
- [C6] Push providers overview: https://www.courier.com/docs/integrations/push/overview
- [C7] Postmark: https://www.courier.com/docs/external-integrations/email/postmark
- [C8] Embedding preferences: https://www.courier.com/docs/platform/preferences/embedding-preferences

**Knock**
- [K1] Security (SOC 2, EU residency roadmap): https://docs.knock.app/developer-tools/security.md
- [K2] Data Processing Addendum: https://knock.app/legal/data-processing-addendum
- [K3] Subprocessors: https://knock.app/legal/subprocessors
- [K4] Pricing: https://knock.app/pricing
- [K5] React feed: https://docs.knock.app/in-app-ui/react/feed.md
- [K6] React preferences: https://docs.knock.app/in-app-ui/react/preferences.md
- [K7] Web push with FCM: https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm.md
- [K8] Postmark: https://docs.knock.app/integrations/email/postmark.md
- [K9] SDKs overview: https://docs.knock.app/developer-tools/sdks.md

**SuprSend**
- [S1] Security: https://docs.suprsend.com/docs/security
- [S2] Enterprise: https://www.suprsend.com/enterprise
- [S3] Terms: https://www.suprsend.com/terms
- [S4] Pricing: https://www.suprsend.com/pricing
- [S5] React SDK integration / customising: https://docs.suprsend.com/docs/react-sdk, https://docs.suprsend.com/docs/react-customize-inbox
- [S6] Send Web Push node: https://docs.suprsend.com/reference/workflow-nodes/send-web-push.md
- [S7] Postmark: https://docs.suprsend.com/docs/postmark
- [S8] API overview (backend SDKs): https://docs.suprsend.com/reference/overview.md

**MagicBell**
- [M1] Security: https://www.magicbell.com/security
- [M2] Pricing: https://www.magicbell.com/pricing
- [M3] Community blog, security (undated): https://community.magicbell.io/blog/security
- [M4] Email channel providers: https://www.magicbell.com/docs/channels/email
