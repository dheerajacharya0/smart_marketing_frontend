import type { MessageCategory } from "@/lib/savings"

export interface ChatMessage {
  from: "biz" | "user"
  text: string
  /** Quick-reply / CTA buttons under a business message. */
  buttons?: string[]
  /** Image header card on a template, drawn as a gradient. */
  media?: { title: string; subtitle: string; gradient: string }
  time: string
}

export interface UseCase {
  id: string
  label: string
  industry: string
  /** Meta's billing category for the opening template. */
  category: MessageCategory
  business: string
  pitch: string
  script: ChatMessage[]
}

/**
 * Real campaign shapes Indian businesses run on WhatsApp. Conversations are
 * illustrative; the category on each is how Meta actually bills that template.
 */
export const USE_CASES: UseCase[] = [
  {
    id: "cart",
    label: "Abandoned cart",
    industry: "D2C fashion",
    category: "marketing",
    business: "Saanjh Ethnic",
    pitch: "Nudge shoppers who left at checkout, with the exact item and a time-boxed offer.",
    script: [
      {
        from: "biz",
        time: "7:42 PM",
        media: { title: "Still thinking it over?", subtitle: "Chanderi kurta set · ₹2,499", gradient: "from-rose-400 via-fuchsia-500 to-indigo-500" },
        text: "Hi Priya 👋 you left something lovely in your cart. Here's 10% off — valid for the next 2 hours.",
        buttons: ["Complete my order", "Not now"],
      },
      { from: "user", time: "7:44 PM", text: "Complete my order" },
      { from: "biz", time: "7:44 PM", text: "Done! Code SAANJH10 applied ✨ Total ₹2,249. Pay by UPI to ship today.", buttons: ["Pay ₹2,249 via UPI"] },
      { from: "user", time: "7:45 PM", text: "Paid ✅" },
    ],
  },
  {
    id: "cod",
    label: "COD → prepaid",
    industry: "E-commerce",
    category: "utility",
    business: "KitchenKart",
    pitch: "Confirm cash-on-delivery orders before they ship and offer a UPI switch. Fewer fake orders, fewer returns.",
    script: [
      {
        from: "biz",
        time: "11:05 AM",
        text: "Order #4821 · Air fryer 4.2L · ₹3,899 (Cash on Delivery). Please confirm so we can dispatch.",
        buttons: ["Confirm order", "Pay via UPI & save ₹50", "Cancel"],
      },
      { from: "user", time: "11:06 AM", text: "Pay via UPI & save ₹50" },
      { from: "biz", time: "11:06 AM", text: "Payment received — ₹3,849 🎉 Your order ships today. Track it anytime here.", buttons: ["Track order"] },
    ],
  },
  {
    id: "festive",
    label: "Festive broadcast",
    industry: "Retail",
    category: "marketing",
    business: "Urban Ghar",
    pitch: "One broadcast to every opted-in customer for Diwali, with a catalogue they can shop without leaving the chat.",
    script: [
      {
        from: "biz",
        time: "9:00 AM",
        media: { title: "Diwali Dhamaka 🪔", subtitle: "Flat 40% off home décor", gradient: "from-amber-300 via-orange-500 to-rose-600" },
        text: "Light up your home this Diwali ✨ Our biggest sale starts now — till Sunday midnight.",
        buttons: ["Shop the sale", "Show me lamps"],
      },
      { from: "user", time: "9:12 AM", text: "Show me lamps" },
      { from: "biz", time: "9:12 AM", text: "Here are our 6 best-sellers under ₹999 🪔 Tap any to add to cart.", buttons: ["View catalogue"] },
    ],
  },
  {
    id: "clinic",
    label: "Appointment reminder",
    industry: "Healthcare",
    category: "utility",
    business: "Smile Dental Care",
    pitch: "Cut no-shows with a reminder the day before and a one-tap reschedule.",
    script: [
      {
        from: "biz",
        time: "6:00 PM",
        text: "Reminder 🦷 Your appointment with Dr. Mehta is tomorrow, 11:00 AM at Smile Dental Care, Indiranagar.",
        buttons: ["Confirm", "Reschedule"],
      },
      { from: "user", time: "6:03 PM", text: "Reschedule" },
      { from: "biz", time: "6:03 PM", text: "No problem! Open slots: Thu 4:30 PM · Fri 10:00 AM · Sat 12:15 PM", buttons: ["Fri 10:00 AM"] },
      { from: "user", time: "6:04 PM", text: "Fri 10:00 AM" },
    ],
  },
  {
    id: "invoice",
    label: "Payment reminder",
    industry: "Distribution",
    category: "utility",
    business: "Shree Traders",
    pitch: "Chase your own invoices politely, with a pay link in the message.",
    script: [
      {
        from: "biz",
        time: "10:30 AM",
        text: "Namaste Rakesh ji 🙏 Invoice INV-2291 for ₹18,400 is due this Friday. Pay securely below.",
        buttons: ["Pay ₹18,400", "Download invoice"],
      },
      { from: "user", time: "1:15 PM", text: "Pay ₹18,400" },
      { from: "biz", time: "1:16 PM", text: "Received with thanks ✅ Receipt RCPT-7713 sent to your email." },
    ],
  },
  {
    id: "otp",
    label: "Login OTP",
    industry: "Fintech & apps",
    category: "authentication",
    business: "PayNest",
    pitch: "Deliver one-time codes on the app your customers already open fifty times a day.",
    script: [
      { from: "biz", time: "8:21 PM", text: "482913 is your PayNest verification code. For your security, do not share this code.", buttons: ["Copy code"] },
      { from: "user", time: "8:21 PM", text: "👍" },
    ],
  },
]
