import type { FaqItem } from "@/lib/landing-faq"
import { FREE_SERVICE_REPLIES_PER_MONTH, formatInr, metaCostInr } from "@/lib/meta-pricing"
import { META_RATES_INR, type MessageCategory } from "@/lib/savings"

/**
 * Public use-case guides (/use-cases/<slug>). Each answers one job an Indian
 * business does on WhatsApp: the template to send, how Meta categorises and
 * prices it, and how to run it in Converszio.
 *
 * Setup steps only name what the product really does (checked 2026-11-19):
 * - templates are created in the dashboard and reviewed by Meta;
 * - an API key (API usage page) can send any approved template, so a store or
 *   booking system can send on its own events. Not every plan includes API
 *   access, so pages say "on plans with API access" rather than naming tiers;
 * - campaigns can be scheduled and fill {{attributes.key}} from contact fields;
 * - automation rules trigger on button replies, keywords, tags and no-reply,
 *   and can tag, reply, assign an agent or call a webhook;
 * - the Shopify connection syncs orders for sales tracking. It does NOT fire
 *   messages on store events, so never say it sends abandoned-cart or COD
 *   messages by itself.
 *
 * Category calls follow Meta's template categorisation: anything promotional
 * (an offer, a discount, "come back") makes a template Marketing, and since
 * April 2025 Meta approves a "utility" template with promotional content as
 * Marketing rather than rejecting it.
 */

export interface UseCaseGuide {
  slug: string
  /** H1 and listing name. */
  title: string
  /** <title>, under 60 characters with the " | Converszio" suffix. */
  metaTitle: string
  /** Meta description, ~140 characters. */
  description: string
  industry: string
  category: MessageCategory
  /** Answer-first opening paragraph. */
  summary: string
  template: {
    name: string
    body: string
    buttons: string[]
    /** Why Meta files it under `category`. */
    whyCategory: string
  }
  /** The mistake that changes the category or the cost. */
  watchOut: string
  steps: { title: string; body: string }[]
  faq: FaqItem[]
}

const FREE_REPLIES = FREE_SERVICE_REPLIES_PER_MONTH.toLocaleString("en-IN")
const MARKETING = formatInr(META_RATES_INR.marketing)
const UTILITY = formatInr(META_RATES_INR.utility)
/** How many times dearer a marketing message is than a utility one, e.g. "7.5". */
const MARKETING_MULTIPLE = (META_RATES_INR.marketing / META_RATES_INR.utility).toFixed(1)
const PER_1000 = {
  marketing: metaCostInr({ marketing: 1000 }),
  utility: metaCostInr({ utility: 1000 }),
}

const SEND_FROM_YOUR_SYSTEM =
  "Create an API key on the API usage page and have your system send the approved template through the Converszio API, filling in the variables. This needs a plan with API access."

const REVIEW_STEP = {
  title: "Create the template",
  body: "Add it under Templates in Converszio and submit it to Meta. Meta reviews templates within 24 hours.",
}

export const USE_CASE_GUIDES: UseCaseGuide[] = [
  {
    slug: "cod-order-confirmation",
    title: "WhatsApp COD order confirmation",
    metaTitle: "WhatsApp COD Order Confirmation Template | Converszio",
    description:
      "Confirm cash-on-delivery orders on WhatsApp before you ship. Template, Meta category and cost per 1,000 messages, and setup steps.",
    industry: "E-commerce",
    category: "utility",
    summary:
      "A COD confirmation is a WhatsApp utility template sent right after a cash-on-delivery order is placed, asking the customer to confirm or cancel before you dispatch. Orders nobody confirms can be held instead of shipped, which is where fake orders and return-to-origin costs come from.",
    template: {
      name: "cod_order_confirmation",
      body: "Hi {{1}}, thanks for your order #{{2}}: {{3}}, ₹{{4}}, cash on delivery. Please confirm so we can dispatch it.",
      buttons: ["Confirm order", "Cancel order"],
      whyCategory:
        "It is about a specific order the customer placed and asks them to act on it, with nothing promotional, so Meta files it as Utility.",
    },
    watchOut:
      "Keep offers out of it. A line like \"pay by UPI and save ₹50\" is promotional, so Meta treats the template as Marketing and you pay the marketing rate on every order. A plain \"Pay online instead\" button with a payment link for the same order is about the transaction, not a promotion.",
    steps: [
      REVIEW_STEP,
      {
        title: "Send it when an order is placed",
        body: `${SEND_FROM_YOUR_SYSTEM} Your store or order system calls it for each new COD order.`,
      },
      {
        title: "Act on the reply",
        body: "Add an automation rule on the button replies: tag the contact as confirmed or cancelled, send a short reply, and call a webhook so your order system can release or cancel the shipment.",
      },
      {
        title: "Chase the silent ones",
        body: "A no-reply rule can tag orders with no answer after a few hours, so your team calls them or holds the order.",
      },
    ],
    faq: [
      {
        q: "Is a COD confirmation message utility or marketing on WhatsApp?",
        a: `Utility, as long as it only confirms the order. Add a discount or an offer to switch to prepaid and Meta treats it as Marketing, which costs about ${MARKETING_MULTIPLE} times more per message in India.`,
      },
      {
        q: "What does a COD confirmation cost per order?",
        a: `One utility message: ${UTILITY} plus GST in India. The customer's reply is free, and your short replies to it count against the free customer-service replies Meta gives each number every month.`,
      },
      {
        q: "Does Converszio send COD confirmations automatically from Shopify?",
        a: "Not by itself. The Shopify connection brings orders in for sales tracking. To send on each new order, your store or a small script calls the Converszio API when an order is placed.",
      },
    ],
  },
  {
    slug: "abandoned-cart-recovery",
    title: "WhatsApp abandoned cart recovery",
    metaTitle: "WhatsApp Abandoned Cart Message Template | Converszio",
    description:
      "Recover abandoned carts on WhatsApp: a template, why Meta bills it as marketing, the cost per 1,000 messages, and setup steps.",
    industry: "D2C and e-commerce",
    category: "marketing",
    summary:
      "An abandoned cart message is a WhatsApp marketing template sent to a shopper who left items at checkout, naming the item and linking back to the cart. Meta bills it as Marketing, so it needs the shopper's opt-in to marketing messages and costs the marketing rate.",
    template: {
      name: "cart_reminder",
      body: "Hi {{1}}, you left {{2}} in your cart. It's still saved for you. Complete your order here: {{3}}",
      buttons: ["Complete my order"],
      whyCategory:
        "It invites someone to buy rather than reporting on a purchase they made, so Meta files it as Marketing, with or without a discount in it.",
    },
    watchOut:
      "Send one reminder, not a sequence. Meta caps how many marketing messages each person receives from all businesses combined, so extra nudges may simply not be delivered (they come back with error 131049), and every delivered one is charged.",
    steps: [
      REVIEW_STEP,
      {
        title: "Send it when a checkout is abandoned",
        body: `${SEND_FROM_YOUR_SYSTEM} Your store calls it when a checkout has been left for, say, an hour.`,
      },
      {
        title: "Measure what it brings back",
        body: "Use a tracked link for the cart URL to see who clicked, and connect Shopify under Integrations so orders come in for sales tracking.",
      },
      {
        title: "Respect opt-outs",
        body: "Campaigns in Converszio skip contacts who opted out. Only message shoppers who agreed to hear from your business on WhatsApp.",
      },
    ],
    faq: [
      {
        q: "Is an abandoned cart message marketing or utility on WhatsApp?",
        a: `Marketing. It asks someone to complete a purchase they haven't made, so Meta bills it at the marketing rate, ${MARKETING} per delivered message in India plus GST.`,
      },
      {
        q: "How much do 1,000 abandoned cart reminders cost?",
        a: `${formatInr(PER_1000.marketing.exGst)} to Meta before GST, ${formatInr(PER_1000.marketing.total)} with GST, for 1,000 delivered messages. Undelivered messages aren't charged.`,
      },
      {
        q: "Do I need opt-in to send abandoned cart reminders?",
        a: "Yes. WhatsApp's policy requires the person's permission to receive messages from your business, and you must honour opt-outs. Collect it at checkout, for example with a WhatsApp updates checkbox.",
      },
    ],
  },
  {
    slug: "appointment-reminders",
    title: "WhatsApp appointment reminders",
    metaTitle: "WhatsApp Appointment Reminder Template | Converszio",
    description:
      "Cut no-shows with WhatsApp appointment reminders: template, Meta category and cost per 1,000 messages, and setup in Converszio.",
    industry: "Healthcare, salons and services",
    category: "utility",
    summary:
      "An appointment reminder is a WhatsApp utility template sent before a booked appointment with the date, time and place, and buttons to confirm or reschedule. A reminder the day before, with a one-tap way to move the slot, turns a no-show into a rescheduled visit.",
    template: {
      name: "appointment_reminder",
      body: "Reminder: your appointment with {{1}} is on {{2}} at {{3}}, {{4}}. Reply below to confirm or reschedule.",
      buttons: ["Confirm", "Reschedule"],
      whyCategory:
        "It is about an appointment the customer booked, so Meta files it as Utility.",
    },
    watchOut:
      "Don't add a promotion (\"book a cleaning and get 20% off\"). Promotional content makes the template Marketing and multiplies its cost.",
    steps: [
      REVIEW_STEP,
      {
        title: "Send reminders from your booking system",
        body: `${SEND_FROM_YOUR_SYSTEM} Your booking system calls it the day before each appointment.`,
      },
      {
        title: "Or schedule them as a campaign",
        body: "Without a booking integration, keep each patient's appointment time in a contact field, tag tomorrow's patients, and schedule a campaign to that tag. Template variables fill in from contact fields.",
      },
      {
        title: "Handle reschedules",
        body: `Add an automation rule on the Reschedule button that replies with open slots or assigns the chat to your front desk. Replies inside the chat are customer-service messages: the first ${FREE_REPLIES} per number each month are free.`,
      },
    ],
    faq: [
      {
        q: "Are WhatsApp appointment reminders utility messages?",
        a: "Yes, when they only remind the customer about an appointment they booked. Add an offer and Meta treats the template as Marketing.",
      },
      {
        q: "How much do 1,000 appointment reminders cost on WhatsApp?",
        a: `${formatInr(PER_1000.utility.exGst)} to Meta before GST, ${formatInr(PER_1000.utility.total)} with GST, for 1,000 delivered utility messages in India.`,
      },
      {
        q: "Can patients reschedule from the WhatsApp message?",
        a: "Yes. A Reschedule button reply can trigger an automation that offers open slots or hands the chat to your team, inside the same WhatsApp conversation.",
      },
    ],
  },
]

export function findUseCaseGuide(slug: string): UseCaseGuide | undefined {
  return USE_CASE_GUIDES.find((g) => g.slug === slug)
}
