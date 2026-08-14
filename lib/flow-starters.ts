import type { FlowDefinition } from "@/services/api"

/**
 * Clonable starter chatbot flows.
 *
 * A blank flow builder is the hardest empty state in the app: you have to
 * invent the conversation, name every node, and wire the branches before you
 * can see anything work. These land you on a complete, valid flow you can run
 * through the simulator immediately, then edit.
 *
 * Each starter is an ordinary draft — nothing saves until you press save, and
 * the result is indistinguishable from a hand-built flow.
 *
 * Every definition here must satisfy `validateFlow` (lib/flow-validation.ts) on
 * arrival, or the builder opens with errors already showing, which is a worse
 * first impression than the blank state it replaced. In particular: button
 * titles are capped at 20 characters, at most 3 buttons per node, every `next`
 * must name a node that exists, and `entryNodeId` must be one of the nodes.
 *
 * Also avoid `name` and `waId` as question variables — they're built-in tokens
 * resolved ahead of collected ones, so a question writing to either is silently
 * shadowed at send time.
 */

export interface FlowStarter {
  id: string
  label: string
  /** One line on the card — the job it does, not the shape of the graph. */
  blurb: string
  name: string
  description: string
  triggerMatchType: "exact" | "contains" | "any"
  triggerKeywords: string[]
  definition: FlowDefinition
}

export const FLOW_STARTERS: FlowStarter[] = [
  {
    id: "welcome-menu",
    label: "Welcome menu",
    blurb: "Greets anyone who says hi and routes them to sales, support, or hours.",
    name: "Welcome menu",
    description: "Greeting with a three-way menu.",
    triggerMatchType: "contains",
    triggerKeywords: ["hi", "hello", "hey", "start"],
    definition: {
      entryNodeId: "welcome",
      nodes: [
        {
          id: "welcome",
          type: "buttons",
          text: "Hi! Thanks for reaching out. What can we help you with?",
          buttons: [
            { title: "Talk to sales", next: "sales" },
            { title: "Get support", next: "support" },
            { title: "Opening hours", next: "hours" },
          ],
          fallbackNext: "fallback",
        },
        {
          id: "sales",
          type: "message",
          text: "Great — someone from our sales team will pick this up shortly.",
          next: "handoff",
        },
        {
          id: "support",
          type: "question",
          text: "Sorry to hear something's wrong. Can you describe the problem in a sentence?",
          variable: "issue",
          next: "handoff",
        },
        {
          id: "hours",
          type: "message",
          text: "We're open Monday to Saturday, 9am to 7pm. Reply any time and we'll get back to you.",
          next: "done",
        },
        {
          id: "fallback",
          type: "message",
          text: "Sorry, I didn't catch that. Let me put you through to a person.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Connecting you to a teammate now." },
        { id: "done", type: "end", text: "Thanks for messaging us!" },
      ],
    },
  },
  {
    id: "lead-capture",
    label: "Lead capture",
    blurb: "Collects a name and what they're after, then hands off to a person.",
    name: "Lead capture",
    description: "Asks for name and requirement before handing off to sales.",
    triggerMatchType: "contains",
    triggerKeywords: ["pricing", "quote", "interested", "demo"],
    definition: {
      entryNodeId: "ask-name",
      nodes: [
        {
          id: "ask-name",
          type: "question",
          // Deliberately NOT `variable: "name"`. `name` and `waId` are built-in
          // tokens resolved before collected variables (see renderText in the
          // backend's flow-definition.ts), so a question storing into `name`
          // is silently shadowed by the contact's WhatsApp profile name — and
          // renders empty when they haven't set one.
          variable: "leadName",
          text: "Happy to help with that! First, what's your name?",
          next: "ask-need",
        },
        {
          id: "ask-need",
          type: "question",
          text: "Thanks {{leadName}}. What are you looking for?",
          variable: "requirement",
          next: "confirm",
        },
        {
          id: "confirm",
          type: "message",
          text: "Got it — thanks {{leadName}}. Passing this to the right person now.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "A teammate will reply shortly." },
      ],
    },
  },
  {
    id: "order-status",
    label: "Order status",
    blurb: "Takes an order number and routes it to a human who can look it up.",
    name: "Order status",
    description: "Collects an order number, then hands off.",
    triggerMatchType: "contains",
    triggerKeywords: ["order", "delivery", "tracking", "where is my"],
    definition: {
      entryNodeId: "ask-order",
      nodes: [
        {
          id: "ask-order",
          type: "question",
          text: "Sure — what's your order number? You'll find it in your confirmation message.",
          variable: "orderNumber",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks! Looking up order {{orderNumber}} now.",
          next: "handoff",
        },
        {
          id: "handoff",
          type: "handoff",
          text: "One of our team will come back to you with an update.",
        },
      ],
    },
  },
  {
    id: "office-hours",
    label: "Out of hours reply",
    blurb: "Acknowledges anyone who messages, so nobody waits wondering.",
    name: "Out of hours reply",
    description: "Catch-all acknowledgement with an option to wait for a person.",
    triggerMatchType: "any",
    triggerKeywords: [],
    definition: {
      entryNodeId: "ack",
      nodes: [
        {
          id: "ack",
          type: "buttons",
          text: "Thanks for your message! Our team is offline right now, but we'll reply first thing.",
          buttons: [
            { title: "That's fine", next: "done" },
            { title: "It's urgent", next: "handoff" },
          ],
          fallbackNext: "done",
        },
        {
          id: "handoff",
          type: "handoff",
          text: "Flagging this as urgent — someone will be with you as soon as possible.",
        },
        { id: "done", type: "end", text: "Talk soon!" },
      ],
    },
  },
]

export function getFlowStarter(id: string | null | undefined): FlowStarter | undefined {
  if (!id) return undefined
  return FLOW_STARTERS.find((starter) => starter.id === id)
}
