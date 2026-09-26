/*
 * Service worker — Web Push for incoming WhatsApp messages.
 *
 * Deliberately does nothing else: no fetch handler, no caching. An offline cache
 * for an app whose every screen is live account data would serve stale balances
 * and conversations, and a buggy fetch handler can take the whole site down in a
 * way a reload doesn't fix. Push is the only reason this file exists.
 *
 * Payload (from the backend's PushService):
 *   { type: "message", conversationId, title, body, url, tag, sentAt }
 */

self.addEventListener("install", () => {
  // Take over from an older copy immediately; there is no cache to migrate.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : "" }
  }

  event.waitUntil(
    (async () => {
      // Same rule as the in-page notification: if someone is looking at the
      // app, the tone and the unread badge already said it. Chrome doesn't
      // require a notification while one of the site's tabs is visible.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      if (windows.some((c) => c.focused)) return

      await self.registration.showNotification(data.title || "New message", {
        body: data.body || "",
        // One notification per conversation: a run of messages replaces rather
        // than stacks, and doesn't re-buzz for each.
        tag: data.tag || data.conversationId || "message",
        // A call re-alerts and stays on screen until dealt with; a message
        // run replaces quietly.
        renotify: data.type === "call",
        requireInteraction: data.type === "call" || data.requireInteraction === true,
        icon: "/icon/192",
        badge: "/notification-badge",
        timestamp: data.sentAt ? Date.parse(data.sentAt) : Date.now(),
        data: { url: data.url || "/dashboard/chat" },
      })
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.url) || "/dashboard/chat"
  const target = new URL(path, self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      // Reuse an open window of the app rather than stacking tabs.
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        if ("navigate" in existing) {
          try {
            await existing.navigate(target)
            return
          } catch {
            // Uncontrolled client — fall through and open a fresh one.
          }
        } else {
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
