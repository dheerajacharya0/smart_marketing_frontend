import type { FlowStarter } from "./flow-starters"

/**
 * Ready-made chatbot flows by industry: the conversations a business in that
 * line of work has every day, already wired. Same rules as every flow starter
 * (see flow-starters.ts): valid on arrival, ≤3 buttons of ≤20 characters,
 * no question writing to `name` or `waId`.
 *
 * Text in [square brackets] is the business's own detail to fill in — the
 * builder opens with it visible rather than with an invented address or menu
 * link a customer could receive by mistake.
 *
 * Keywords differ between flows of the same industry so two starters taken
 * together don't fight over one message; a business mixing industries can
 * reorder them by priority like any flow.
 */

export const INDUSTRIES = [
  { id: "general", label: "General" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "restaurant", label: "Restaurant" },
  { id: "healthcare", label: "Clinic" },
  { id: "real-estate", label: "Real estate" },
  { id: "education", label: "Education" },
  { id: "salon", label: "Salon & spa" },
  { id: "travel", label: "Travel" },
  { id: "automotive", label: "Automotive" },
] as const

export type IndustryId = (typeof INDUSTRIES)[number]["id"]

export const INDUSTRY_FLOW_STARTERS: FlowStarter[] = [
  // ---------------------------------------------------------------- E-commerce
  {
    id: "ecom-order-help",
    industry: "ecommerce",
    label: "Order help",
    blurb: "Tracking, returns and exchanges — asks for the order number first.",
    name: "Order help",
    description: "Routes order questions: track, return or exchange, or a person.",
    triggerMatchType: "contains",
    triggerKeywords: ["order", "track", "delivery", "return", "exchange"],
    definition: {
      entryNodeId: "menu",
      nodes: [
        {
          id: "menu",
          type: "buttons",
          text: "Hi! Happy to help with your order. What do you need?",
          buttons: [
            { title: "Track my order", next: "track-id" },
            { title: "Return / exchange", next: "return-id" },
            { title: "Something else", next: "handoff" },
          ],
          fallbackNext: "handoff",
        },
        {
          id: "track-id",
          type: "question",
          text: "Please share your order number (it's in your confirmation message).",
          variable: "orderId",
          next: "track-ack",
        },
        {
          id: "track-ack",
          type: "message",
          text: "Thanks! Checking order {{orderId}} now — we'll reply with its status shortly.",
          next: "handoff",
        },
        {
          id: "return-id",
          type: "question",
          text: "Sorry it didn't work out. Which order number is it?",
          variable: "returnOrderId",
          next: "return-reason",
        },
        {
          id: "return-reason",
          type: "question",
          text: "And what's the reason — wrong size, damaged, or something else?",
          variable: "returnReason",
          next: "return-ack",
        },
        {
          id: "return-ack",
          type: "message",
          text: "Got it. Our team will share the return or exchange steps for order {{returnOrderId}}.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "A teammate will reply here shortly." },
      ],
    },
  },
  {
    id: "ecom-product-enquiry",
    industry: "ecommerce",
    label: "Product enquiry",
    blurb: "Asks which product and the delivery pincode, then passes to sales.",
    name: "Product enquiry",
    description: "Captures the product and pincode for price and delivery questions.",
    triggerMatchType: "contains",
    triggerKeywords: ["price", "available", "in stock", "size"],
    definition: {
      entryNodeId: "ask-product",
      nodes: [
        {
          id: "ask-product",
          type: "question",
          text: "Thanks for your interest! Which product are you asking about? A name or link works.",
          variable: "product",
          next: "ask-pincode",
        },
        {
          id: "ask-pincode",
          type: "question",
          text: "And your delivery pincode, so we can check availability and delivery time?",
          variable: "pincode",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Perfect — checking {{product}} for {{pincode}}. We'll reply with price and delivery details.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Someone from our team will reply shortly." },
      ],
    },
  },

  // ---------------------------------------------------------------- Restaurant
  {
    id: "resto-menu-order",
    industry: "restaurant",
    label: "Menu, order & table",
    blurb: "Shares the menu, takes a delivery order, or books a table.",
    name: "Menu and orders",
    description: "Menu link, delivery order capture and table booking.",
    triggerMatchType: "contains",
    triggerKeywords: ["menu", "order food", "hungry", "table"],
    definition: {
      entryNodeId: "menu",
      nodes: [
        {
          id: "menu",
          type: "buttons",
          text: "Welcome to [Restaurant name]! What would you like to do?",
          buttons: [
            { title: "See the menu", next: "menu-link" },
            { title: "Order for delivery", next: "order-items" },
            { title: "Book a table", next: "table-guests" },
          ],
          fallbackNext: "handoff",
        },
        {
          id: "menu-link",
          type: "end",
          text: "Here's our menu: [menu link]. Reply \"order\" whenever you're ready!",
        },
        {
          id: "order-items",
          type: "question",
          text: "What would you like to order? List the dishes and quantities.",
          variable: "orderItems",
          next: "order-address",
        },
        {
          id: "order-address",
          type: "question",
          text: "Where should we deliver? Please send the full address with a landmark.",
          variable: "deliveryAddress",
          next: "order-ack",
        },
        {
          id: "order-ack",
          type: "message",
          text: "Thanks! We've got your order: {{orderItems}}. We'll confirm the total and delivery time shortly.",
          next: "handoff",
        },
        {
          id: "table-guests",
          type: "question",
          text: "Lovely! How many guests?",
          variable: "guests",
          next: "table-when",
        },
        {
          id: "table-when",
          type: "question",
          text: "Which date and time would you like?",
          variable: "tableTime",
          next: "table-ack",
        },
        {
          id: "table-ack",
          type: "message",
          text: "Noted: a table for {{guests}} at {{tableTime}}. We'll confirm availability in a moment.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our team will reply shortly." },
      ],
    },
  },
  {
    id: "resto-feedback",
    industry: "restaurant",
    label: "Feedback",
    blurb: "Asks how the meal was; happy guests get the review link, unhappy ones a person.",
    name: "Meal feedback",
    description: "Collects feedback and routes complaints to the team.",
    triggerMatchType: "contains",
    triggerKeywords: ["feedback", "review", "complaint"],
    definition: {
      entryNodeId: "rate",
      nodes: [
        {
          id: "rate",
          type: "buttons",
          text: "Thanks for dining with us! How was everything?",
          buttons: [
            { title: "Loved it", next: "loved" },
            { title: "It was okay", next: "okay" },
            { title: "Not happy", next: "complaint" },
          ],
          fallbackNext: "okay",
        },
        {
          id: "loved",
          type: "end",
          text: "So glad to hear it! Would you leave us a quick review? [review link]",
        },
        {
          id: "okay",
          type: "question",
          text: "Thanks for being honest. What could we have done better?",
          variable: "improvement",
          next: "okay-thanks",
        },
        { id: "okay-thanks", type: "end", text: "Thank you — we'll pass this to the kitchen and team." },
        {
          id: "complaint",
          type: "question",
          text: "We're sorry. Please tell us what went wrong — a manager will look into it personally.",
          variable: "complaint",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our manager will reply to you shortly." },
      ],
    },
  },

  // ---------------------------------------------------------------- Clinic / healthcare
  {
    id: "clinic-appointment",
    industry: "healthcare",
    label: "Book an appointment",
    blurb: "Takes the patient's name, department and preferred time.",
    name: "Appointment booking",
    description: "Collects patient details and a preferred slot for the front desk.",
    triggerMatchType: "contains",
    triggerKeywords: ["appointment", "doctor", "consult", "checkup"],
    definition: {
      entryNodeId: "ask-patient",
      nodes: [
        {
          id: "ask-patient",
          type: "question",
          text: "Hello! Let's book your appointment. What is the patient's full name?",
          variable: "patientName",
          next: "department",
        },
        {
          id: "department",
          type: "buttons",
          text: "Which do you need?",
          buttons: [
            { title: "General physician", next: "ask-time" },
            { title: "Specialist", next: "ask-specialist" },
            { title: "Follow-up visit", next: "ask-time" },
          ],
          fallbackNext: "ask-time",
        },
        {
          id: "ask-specialist",
          type: "question",
          text: "Which specialist or doctor would you like to see?",
          variable: "specialist",
          next: "ask-time",
        },
        {
          id: "ask-time",
          type: "question",
          text: "What day and time suit you best?",
          variable: "preferredTime",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thank you. We'll confirm {{patientName}}'s appointment for {{preferredTime}} shortly. For an emergency, please call [emergency number].",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our front desk will confirm your slot." },
      ],
    },
  },
  {
    id: "clinic-reports",
    industry: "healthcare",
    label: "Reports & results",
    blurb: "Asks for the patient ID so the team can share reports.",
    name: "Reports and results",
    description: "Collects a patient or bill number for report requests.",
    triggerMatchType: "contains",
    triggerKeywords: ["report", "result", "lab"],
    definition: {
      entryNodeId: "ask-id",
      nodes: [
        {
          id: "ask-id",
          type: "question",
          text: "We can help with your reports. Please share the patient ID or bill number.",
          variable: "patientRef",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks. We'll check {{patientRef}} and share the report here once it's ready.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our team will reply shortly." },
      ],
    },
  },

  // ---------------------------------------------------------------- Real estate
  {
    id: "re-property-enquiry",
    industry: "real-estate",
    label: "Property enquiry",
    blurb: "Buy, rent or sell — captures location and budget for an agent.",
    name: "Property enquiry",
    description: "Qualifies a property lead by intent, location and budget.",
    triggerMatchType: "contains",
    triggerKeywords: ["property", "flat", "apartment", "plot", "rent"],
    definition: {
      entryNodeId: "intent",
      nodes: [
        {
          id: "intent",
          type: "buttons",
          text: "Hi! Are you looking to buy, rent or sell?",
          buttons: [
            { title: "Buy", next: "location" },
            { title: "Rent", next: "location" },
            { title: "Sell", next: "sell-details" },
          ],
          fallbackNext: "location",
        },
        {
          id: "location",
          type: "question",
          text: "Which area or locality are you interested in?",
          variable: "area",
          next: "budget",
        },
        {
          id: "budget",
          type: "question",
          text: "What's your budget range, and what size are you looking for (e.g. 2BHK)?",
          variable: "budget",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks! We'll share options in {{area}} for {{budget}} shortly.",
          next: "handoff",
        },
        {
          id: "sell-details",
          type: "question",
          text: "Great — tell us about the property: location, size and your expected price.",
          variable: "sellDetails",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "One of our agents will reply shortly." },
      ],
    },
  },
  {
    id: "re-site-visit",
    industry: "real-estate",
    label: "Schedule a site visit",
    blurb: "Books a visit: which project, when, and how many people.",
    name: "Site visit",
    description: "Collects project, date and group size for a site visit.",
    triggerMatchType: "contains",
    triggerKeywords: ["site visit", "visit", "see the property"],
    definition: {
      entryNodeId: "project",
      nodes: [
        {
          id: "project",
          type: "question",
          text: "Happy to arrange a visit! Which project or listing would you like to see?",
          variable: "project",
          next: "when",
        },
        {
          id: "when",
          type: "question",
          text: "Which day and time work for you?",
          variable: "visitTime",
          next: "people",
        },
        {
          id: "people",
          type: "question",
          text: "How many people will come?",
          variable: "visitors",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Noted: {{project}}, {{visitTime}}, {{visitors}} people. We'll confirm and share the location.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our agent will confirm your visit." },
      ],
    },
  },

  // ---------------------------------------------------------------- Education
  {
    id: "edu-admission",
    industry: "education",
    label: "Admissions",
    blurb: "Courses and fees, a free demo class, or a counsellor.",
    name: "Admissions enquiry",
    description: "Answers admission questions and books demo classes.",
    triggerMatchType: "contains",
    triggerKeywords: ["admission", "course", "fees", "demo class"],
    definition: {
      entryNodeId: "menu",
      nodes: [
        {
          id: "menu",
          type: "buttons",
          text: "Welcome to [Institute name]! How can we help?",
          buttons: [
            { title: "Courses & fees", next: "courses" },
            { title: "Book a demo class", next: "student" },
            { title: "Talk to counsellor", next: "handoff" },
          ],
          fallbackNext: "handoff",
        },
        {
          id: "courses",
          type: "end",
          text: "Here are our courses and fees: [brochure link]. Reply \"demo\" to book a free demo class.",
        },
        {
          id: "student",
          type: "question",
          text: "Great! What's the student's name?",
          variable: "studentName",
          next: "grade",
        },
        {
          id: "grade",
          type: "question",
          text: "Which class/grade or exam are they preparing for?",
          variable: "grade",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks! We'll share demo class timings for {{studentName}} ({{grade}}) shortly.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "A counsellor will reply shortly." },
      ],
    },
  },
  {
    id: "edu-timetable",
    industry: "education",
    label: "Timetable & holidays",
    blurb: "Answers \"when is class?\" without anyone picking up the phone.",
    name: "Timetable",
    description: "Shares the timetable and holiday list on request.",
    triggerMatchType: "contains",
    triggerKeywords: ["timetable", "schedule", "holiday", "class timing"],
    definition: {
      entryNodeId: "menu",
      nodes: [
        {
          id: "menu",
          type: "buttons",
          text: "What would you like to see?",
          buttons: [
            { title: "Class timetable", next: "timetable" },
            { title: "Holiday list", next: "holidays" },
            { title: "Ask a question", next: "handoff" },
          ],
          fallbackNext: "handoff",
        },
        { id: "timetable", type: "end", text: "This term's timetable: [timetable link]" },
        { id: "holidays", type: "end", text: "Upcoming holidays: [holiday list link]" },
        { id: "handoff", type: "handoff", text: "Our office will reply shortly." },
      ],
    },
  },

  // ---------------------------------------------------------------- Salon & spa
  {
    id: "salon-booking",
    industry: "salon",
    label: "Book a service",
    blurb: "Hair, skin or nails — takes the service and a preferred slot.",
    name: "Service booking",
    description: "Books salon and spa services.",
    triggerMatchType: "contains",
    triggerKeywords: ["book", "slot", "haircut", "facial"],
    definition: {
      entryNodeId: "service",
      nodes: [
        {
          id: "service",
          type: "buttons",
          text: "Hi! Which service would you like to book?",
          buttons: [
            { title: "Hair", next: "details" },
            { title: "Skin & spa", next: "details" },
            { title: "Nails & more", next: "details" },
          ],
          fallbackNext: "details",
        },
        {
          id: "details",
          type: "question",
          text: "Lovely! Which exact service (e.g. haircut, facial, manicure)?",
          variable: "service",
          next: "when",
        },
        {
          id: "when",
          type: "question",
          text: "What day and time would you like?",
          variable: "slot",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Noted: {{service}} at {{slot}}. We'll confirm your booking shortly.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our team will confirm your slot." },
      ],
    },
  },
  {
    id: "salon-offers",
    industry: "salon",
    label: "Prices & offers",
    blurb: "Sends the price list and current offers, then offers to book.",
    name: "Prices and offers",
    description: "Shares rates and offers with a booking shortcut.",
    triggerMatchType: "contains",
    triggerKeywords: ["offer", "price list", "rates", "package"],
    definition: {
      entryNodeId: "prices",
      nodes: [
        {
          id: "prices",
          type: "buttons",
          text: "Here's our price list and this month's offers: [price list link]. Want to book?",
          buttons: [
            { title: "Yes, book now", next: "handoff" },
            { title: "Maybe later", next: "later" },
          ],
          fallbackNext: "later",
        },
        { id: "later", type: "end", text: "No problem! Message \"book\" anytime." },
        { id: "handoff", type: "handoff", text: "Great — our team will help you pick a slot." },
      ],
    },
  },

  // ---------------------------------------------------------------- Travel
  {
    id: "travel-trip-enquiry",
    industry: "travel",
    label: "Trip enquiry",
    blurb: "Destination, dates and group size — a lead an agent can quote on.",
    name: "Trip enquiry",
    description: "Qualifies holiday and tour enquiries.",
    triggerMatchType: "contains",
    triggerKeywords: ["trip", "package", "tour", "holiday"],
    definition: {
      entryNodeId: "where",
      nodes: [
        {
          id: "where",
          type: "question",
          text: "Exciting! Where would you like to go?",
          variable: "destination",
          next: "when",
        },
        {
          id: "when",
          type: "question",
          text: "When are you planning to travel, and for how many days?",
          variable: "travelDates",
          next: "who",
        },
        {
          id: "who",
          type: "question",
          text: "How many travellers (adults and children)?",
          variable: "travellers",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks! We'll put together options for {{destination}} ({{travelDates}}, {{travellers}}).",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "A travel expert will reply with packages shortly." },
      ],
    },
  },
  {
    id: "travel-booking-help",
    industry: "travel",
    label: "Booking help",
    blurb: "Change or cancel a booking, starting from the booking reference.",
    name: "Booking help",
    description: "Handles changes and cancellations to existing bookings.",
    triggerMatchType: "contains",
    triggerKeywords: ["booking", "ticket", "pnr", "cancel"],
    definition: {
      entryNodeId: "menu",
      nodes: [
        {
          id: "menu",
          type: "buttons",
          text: "Need help with a booking?",
          buttons: [
            { title: "Change booking", next: "ref" },
            { title: "Cancel booking", next: "ref" },
            { title: "Something else", next: "handoff" },
          ],
          fallbackNext: "handoff",
        },
        {
          id: "ref",
          type: "question",
          text: "Please share your booking reference or PNR.",
          variable: "bookingRef",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks — looking up {{bookingRef}} now.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our team will reply shortly." },
      ],
    },
  },

  // ---------------------------------------------------------------- Automotive
  {
    id: "auto-service-booking",
    industry: "automotive",
    label: "Service booking",
    blurb: "Vehicle model, registration number and a preferred date.",
    name: "Vehicle service booking",
    description: "Books vehicle servicing and repairs.",
    triggerMatchType: "contains",
    triggerKeywords: ["service", "servicing", "repair", "pickup"],
    definition: {
      entryNodeId: "model",
      nodes: [
        {
          id: "model",
          type: "question",
          text: "Hi! Which vehicle is it (make and model)?",
          variable: "vehicle",
          next: "reg",
        },
        {
          id: "reg",
          type: "question",
          text: "And the registration number?",
          variable: "regNumber",
          next: "issue",
        },
        {
          id: "issue",
          type: "buttons",
          text: "What does it need?",
          buttons: [
            { title: "Regular service", next: "when" },
            { title: "Repair / issue", next: "issue-details" },
            { title: "Not sure", next: "when" },
          ],
          fallbackNext: "when",
        },
        {
          id: "issue-details",
          type: "question",
          text: "Briefly describe the problem.",
          variable: "issueDetails",
          next: "when",
        },
        {
          id: "when",
          type: "question",
          text: "Which day would you like to bring it in?",
          variable: "serviceDate",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Noted: {{vehicle}} ({{regNumber}}) on {{serviceDate}}. We'll confirm your slot shortly.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our service advisor will confirm." },
      ],
    },
  },
  {
    id: "auto-test-drive",
    industry: "automotive",
    label: "Test drive",
    blurb: "Which model, which city, and when — straight to the showroom.",
    name: "Test drive request",
    description: "Books test drives for new vehicles.",
    triggerMatchType: "contains",
    triggerKeywords: ["test drive", "new car", "new bike", "showroom"],
    definition: {
      entryNodeId: "model",
      nodes: [
        {
          id: "model",
          type: "question",
          text: "Great choice to try before you buy! Which model would you like to test drive?",
          variable: "model",
          next: "city",
        },
        {
          id: "city",
          type: "question",
          text: "Which city or area are you in?",
          variable: "city",
          next: "when",
        },
        {
          id: "when",
          type: "question",
          text: "When would you like to come in?",
          variable: "driveTime",
          next: "ack",
        },
        {
          id: "ack",
          type: "message",
          text: "Thanks! We'll confirm your {{model}} test drive in {{city}} for {{driveTime}}.",
          next: "handoff",
        },
        { id: "handoff", type: "handoff", text: "Our showroom team will reply shortly." },
      ],
    },
  },
]
