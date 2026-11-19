# Can Cadence deliver web push without a mobile app?

Research for issue #4 (map #2, Cadence notifications). All sources accessed 2026-11-19 unless noted.

## Answer

**Yes, with a known gap.** Standard web push (Push API + Service Worker + VAPID) works in the browser tab on desktop Chrome, Edge, Firefox and Safari (macOS 13 Ventura and later), and on Android Chrome/Firefox, with no install step. On **iPhone and iPad it works only once the user has added Cadence to the Home Screen** as a web app (iOS/iPadOS 16.4+). An iOS user who just browses Cadence in Safari, Chrome or any other iOS browser cannot receive web push at all.

So web push is realistic as a **secondary, opt-in channel**, not the channel of record. In-app Feed and email still have to carry anything important. The work is modest: a manifest, a service worker, a subscribe flow, and a vendor that accepts browser subscriptions. The bigger cost is UX: a pre-prompt, a separate "install to Home Screen" flow for iOS, and handling denied or revoked permission.

## Browser support

| Platform | Web push? | Conditions | Source |
|---|---|---|---|
| Chrome, Edge (desktop) | Yes | HTTPS, service worker, user grants permission | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) ("Baseline widely available" since March 2023) |
| Firefox (desktop) | Yes | Prompt only after a user gesture (Firefox 72+). There is a quota on pushes that show no notification. | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API); [Mozilla, Restricting notification permission prompts](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/) |
| Safari, macOS | Yes, Safari 16+ on macOS 13 Ventura+ | Standards-based, no Apple Developer account needed, explicit user gesture, `userVisibleOnly: true` | [WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/) |
| Android (Chrome, Firefox and other Chromium browsers) | Yes, in the browser tab | Same as desktop. Installing the app is not required. | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API); [web.dev push overview](https://web.dev/articles/push-notifications-overview) |
| iOS / iPadOS 16.4+ | **Only as a Home Screen web app** | Manifest with `display: standalone` or `fullscreen`, user adds the site to the Home Screen, permission requested from a user gesture inside the installed app | [WebKit, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| iOS Safari or other iOS browsers, in a tab | **No** | Web push "not available in Safari or other browsers" on iOS | [firt.dev iOS PWA compatibility](https://firt.dev/notes/pwa-ios/) |

iOS details:

- **iOS/iPadOS 18.4 added Declarative Web Push.** The browser can render a JSON `web_push` payload without running a service worker, and an optional service worker can still change the message. It still applies only to installed Home Screen web apps on iOS. Sources: [WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/); [firt.dev](https://firt.dev/notes/pwa-ios/).
- **iOS 26 changed the "Add to Home Screen" default.** Sites now open as a web app by default, even without a manifest, so installing is a little easier. The user still has to do it by hand through the Share sheet. There is no install prompt Cadence can trigger. Source: [firt.dev](https://firt.dev/notes/pwa-ios/).
- **EU:** Apple planned to remove Home Screen web apps in the EU in the iOS 17.4 beta, then reversed course. They still work in the EU, built on WebKit. Source: [Apple, Update on apps distributed in the EU](https://developer.apple.com/support/dma-and-apps-in-the-eu/). This is a policy risk to watch, not a current blocker.
- Apple's push endpoints are on `*.push.apple.com`. Allow them if outbound traffic is restricted. Source: [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## What Cadence needs

Cadence has none of these today: there is no manifest and no service worker in `public/` or `app/`.

1. **HTTPS.** The Push API needs a secure context. `localhost` counts as secure, so dev works. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API); [SuprSend docs](https://docs.suprsend.com/docs/js-webpush))
2. **A service worker** served from the site root, for example `/sw.js`. Its `push` handler calls `showNotification()` and its `notificationclick` handler opens the target route. Vendors usually provide a script you load with `importScripts`, or a worker file of their own. React Router/Vite only has to serve it as a static file from `public/`. ([web.dev](https://web.dev/articles/push-notifications-overview); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API))
3. **VAPID key pair.** The public key goes to `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, and the private key signs sends. Chrome and Safari require VAPID, and Safari requires `userVisibleOnly: true`. Every push must show a visible notification, or browsers may revoke the subscription. ([web.dev](https://web.dev/articles/push-notifications-overview); [WebKit 12945](https://webkit.org/blog/12945/meet-web-push/))
4. **Subscription storage.** Each device produces a `PushSubscription` with an endpoint and `p256dh`/`auth` keys. It belongs to a user and a device, a user can have several, and it has to be removed when the push service returns 404 or 410 or `pushsubscriptionchange` fires. The endpoint is a capability URL, so treat it as a secret. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)) A vendor usually stores these for Cadence.
5. **Web app manifest** (`name`, `icons`, `display: standalone`, `start_url`, `id`). It is required for iOS, and a cheap addition for everyone else. ([WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))

## Permission prompt: best practice and browser restrictions

What the browsers do:

- **Safari (macOS and iOS)** only allows the request in response to an explicit user gesture. ([WebKit 12945](https://webkit.org/blog/12945/meet-web-push/), [13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))
- **Firefox 72+** shows only a small URL-bar icon unless the request follows a click, tap or key press. "Never" blocks the site permanently. ([Mozilla](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/))
- **Chrome** shows a collapsing "permission chip" instead of a bubble unless the request follows a user gesture (Chrome 98+). ([Chrome, permissions chip](https://developer.chrome.com/blog/permissions-chip)) It also moves sites with very low accept rates, or with abusive prompts or notifications, into the **quieter UI**, which shows only a bell icon and no prompt (Chrome 80/84). ([New in Chrome 84](https://developer.chrome.com/blog/new-in-chrome-84); [CrUX notification permission data](https://developer.chrome.com/blog/notification-permission-data-in-crux))
- **Chrome auto-revocation (2025):** Chrome on desktop and Android removes notification permission from low-engagement sites that send many notifications. **Installed web apps are excluded.** ([Google, Reducing notification overload](https://blog.google/chromium/automatic-notification-permission/))
- **Chrome push rate limits (from January 2026):** sites flagged as disruptive are throttled and get HTTP 429. Ordinary sites are not affected. ([Chrome, web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits))

What works in practice ([web.dev, Permissions best practices](https://web.dev/articles/permissions-best-practices)):

- **Never prompt on page load.** Chrome data puts the allow rate at about 12% for prompts with no intent signal and about 30% after a user interaction.
- **Use an in-page pre-prompt** that explains the value. Call `Notification.requestPermission()` only after the user says yes there, so a "not now" never turns into a permanent browser denial.
- **Ask at a moment of clear value.** For Cadence that could be "Notify me when my Refund Request is decided" (Student), "Notify me of new Enrollments" (Instructor), or a toggle on the notification preferences page.
- **Offer an alternative**, such as email, and handle the `denied` state with browser-specific instructions to re-enable.

## Vendors: native web push support

| Vendor | Native browser web push? | How | Source |
|---|---|---|---|
| **MagicBell** | **Yes** | A first-class "Web Push" channel with your VAPID keys (dashboard, or `PUT /v2/integrations/web_push`). Browser `PushSubscription` tokens are stored with `PUT /v2/channels/web_push/tokens`. A WebPushButton component plus a service worker that `importScripts` MagicBell's script. | [MagicBell Web Push channel](https://www.magicbell.com/docs/channels/web_push); [MagicBell web components](https://www.magicbell.com/docs/libraries/magicbell-webcomponents) |
| **SuprSend** | **Yes** | A first-class WebPush vendor with the VAPID key from the dashboard (Vendors > WebPush). The JS/React SDK `webpush.registerPush()` runs from a user action. `serviceworker.js` at the root imports SuprSend's worker from a CDN. The docs include a Chrome/Firefox/Safari (macOS)/Edge feature matrix. Action buttons render only on Chromium, and iOS is not covered in that page. | [SuprSend JS WebPush](https://docs.suprsend.com/docs/js-webpush); [SuprSend React WebPush](https://docs.suprsend.com/docs/react-webpush); [SuprSend web push channel](https://docs.suprsend.com/docs/web-push) |
| **Knock** | **No (indirect)** | "Knock does not have a first-party web push channel." You add an FCM channel, use the Firebase web SDK with `firebase-messaging-sw.js` and the Firebase VAPID key, then store the FCM token in Knock as channel data. OneSignal is also a supported push provider. | [Knock tutorial: web push with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm); [Knock push overview](https://docs.knock.app/integrations/push/overview) |
| **Novu Cloud** | **No (indirect)** | No native VAPID provider. The push providers are FCM, APNs, Expo, OneSignal, Pusher Beams, Pushpad and Push Webhook. Browser push goes through FCM (web), Pushpad (a web push service with its own SDK), OneSignal, or Push Webhook, where Novu POSTs an HMAC-signed request to Cadence and Cadence sends it with a library such as `web-push`. That last route means Cadence owns VAPID and subscriptions. | [Novu push providers](https://docs.novu.co/platform/integrations/push); [Novu Push Webhook](https://docs.novu.co/platform/integrations/push/push-webhook); [Novu Pushpad](https://docs.novu.co/platform/integrations/push/pushpad) |
| **Courier** | **No (indirect)** | The push providers are APNs, FCM, Expo, OneSignal, Airship, SNS, Pusher Beams, Pusher, MagicBell, Pushbullet, Beamer and NowPush. Browser push goes through FCM (web) or OneSignal, or even MagicBell as a downstream provider. | [Courier push providers](https://www.courier.com/docs/external-integrations/push/intro); [Courier Node.js push guide](https://www.courier.com/guides/nodejs-send-push-notifications) |

"Indirect" means a second vendor joins the stack (Firebase/Google, OneSignal or Pushpad), with its own SDK, data processing terms and DPA. That counts against map #2's hard constraints (EU data residency or DPA, SOC 2). Firebase Cloud Messaging is free, but Google then processes the device tokens. With MagicBell or SuprSend the browser subscriptions stay with the one vendor.

## Who web push would miss

- **iPhone/iPad users who don't install Cadence to the Home Screen.** This is most iOS users by default. The install is manual, there is no prompt Cadence can trigger, and it has to be done before push can be offered. Mobile Safari share is significant for consumer audiences, so expect a large gap among mobile Students.
- **Users who deny or ignore the prompt.** Typical allow rates are well under half even with good UX (about 30% after interaction, per web.dev).
- **Users on shared or locked-down machines,** such as corporate browsers where policy disables notifications, which matters for Team Admins. Also anyone with OS-level Focus or Do Not Disturb on.
- **Users who don't come back:** a subscription only exists on a device where the user opted in, and Chrome may auto-revoke it on low-engagement sites. Installed web apps are exempt.
- **Older systems:** Safari on macOS before Ventura, and iOS before 16.4.

## Rough cost

**Engineering (small to medium, roughly 3–6 dev-days with a native-web-push vendor):**

- `public/manifest.webmanifest` and icons, linked from `app/root.tsx`
- `public/sw.js`, the vendor's worker or our own `push` and `notificationclick` handlers
- A client hook or component for the pre-prompt, then `requestPermission` and subscribe, then handing the token to the vendor. Handle the `default`, `granted` and `denied` states and feature detection.
- An iOS-only "Add to Home Screen" explainer, shown when `navigator.standalone` is false on iOS
- Per-type web push opt-in or opt-out in the preferences UI
- Testing across Chrome, Firefox, Safari macOS, Android and an iOS Home Screen install. Push is hard to automate, so this is mostly manual.

With Knock, Novu or Courier, add Firebase or OneSignal setup and its compliance review. Novu's Push Webhook route also means building subscription storage, `web-push` sending and 410 cleanup ourselves, plus about 2–4 more days.

**UX:** a pre-prompt pattern, contextual opt-in points, the iOS install flow (several steps for the user), "notifications blocked" recovery copy, and keeping notifications useful so Chrome's quiet UI and revocation don't kick in. Notifications must always be visible; silent push is not allowed.

**Recommendation for the map:** treat web push as an optional channel layered on the in-app Feed and email, never the only channel for a notification type. If web push ships, it favours vendors with native web push (**MagicBell, SuprSend**). Knock, Novu and Courier need a second push provider.
