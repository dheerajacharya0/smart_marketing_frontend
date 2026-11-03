/**
 * What to tell a customer when Meta's Embedded Signup refuses them, keyed by
 * the code Meta sends on the ERROR / CANCEL postMessage (see
 * `embedded-signup-session.ts`). Meta's own text is generic and often names no
 * fix; the guidance lives here so it can't drift with Meta's wording.
 *
 * Sources: Meta's Embedded Signup Flow Errors reference, plus the research in
 * `reports/WhatsApp onboarding self-serve FAQ.md`. Codes Meta doesn't document
 * stably fall back to message matching, then to a generic guide. Unmapped
 * codes still reach Sentry via `reportError` in `facebook-sdk.ts` — that's the
 * backlog for new rows here.
 */

export interface SignupErrorGuide {
  id: string
  title: string
  /** Why it happened, in plain words. */
  cause: string
  /** What the customer does, in order. */
  steps: string[]
  /** The fix happens in Facebook / WhatsApp, not in this dashboard. */
  metaSide: boolean
}

const BUSINESS_SUITE_WHATSAPP_ACCOUNTS = "business.facebook.com → Settings → Accounts → WhatsApp accounts"

const GUIDES = {
  numberClaimedElsewhere: {
    id: "numberClaimedElsewhere",
    title: "This number is still attached somewhere else",
    cause:
      "Facebook still sees this number on another WhatsApp account. Often it's left over from an earlier setup that was never finished, in another of your business portfolios.",
    steps: [
      `Open ${BUSINESS_SUITE_WHATSAPP_ACCOUNTS}. Use the business switcher at the top left to check every business portfolio you manage.`,
      "If the number appears (often marked Unverified), open it in WhatsApp Manager → Phone numbers and delete it. Facebook will ask for your Facebook password.",
      "If it's on personal WhatsApp on a phone, move it to the WhatsApp Business app first, or delete that WhatsApp account to use the number only here.",
      "Wait about 5 minutes, then try again.",
    ],
    metaSide: true,
  },
  connectedToOtherProvider: {
    id: "connectedToOtherProvider",
    title: "This number is connected to another provider",
    cause: "The number is already linked to the WhatsApp Business Platform through another company or tool.",
    steps: [
      "In the WhatsApp Business app on the phone: Settings → Account → Business Platform → Disconnect. Or release it from the other provider's dashboard.",
      "Wait about 15 minutes, then try again.",
    ],
    metaSide: true,
  },
  sharedWithPartner: {
    id: "sharedWithPartner",
    title: "This number's account is shared with another partner",
    cause: "The WhatsApp account is already shared with another provider, and Facebook doesn't allow switching in this step.",
    steps: [
      "Remove the other partner's access to this WhatsApp account in Facebook Business settings, or ask that provider to release it.",
      "Then try again.",
    ],
    metaSide: true,
  },
  wrongBusiness: {
    id: "wrongBusiness",
    title: "This number belongs to a different business",
    cause: "The number isn't linked to the business you picked in the Facebook window.",
    steps: [
      "Try again and pick the business that owns this number.",
      `Or remove it from the other business first: ${BUSINESS_SUITE_WHATSAPP_ACCOUNTS}.`,
    ],
    metaSide: true,
  },
  notOnBusinessApp: {
    id: "notOnBusinessApp",
    title: "This number isn't on the WhatsApp Business app",
    cause: "You chose to keep using the WhatsApp Business app, but this number isn't registered on it.",
    steps: [
      "Install the WhatsApp Business app and register the number there first, then try again.",
      "Or go back and choose \"A new number\" to use it only from this dashboard.",
    ],
    metaSide: false,
  },
  notEligibleYet: {
    id: "notEligibleYet",
    title: "Facebook can't connect this app number yet",
    cause: "Facebook couldn't yet confirm this WhatsApp Business app number is eligible. Newer or rarely used numbers hit this.",
    steps: [
      "Keep using the number normally in the WhatsApp Business app for a while, then try again.",
      "Or connect it as \"A new number\" instead (this removes it from the app).",
    ],
    metaSide: true,
  },
  updateBusinessApp: {
    id: "updateBusinessApp",
    title: "Update the WhatsApp Business app",
    cause: "Keeping your number on the app needs a newer version of the WhatsApp Business app.",
    steps: ["Update the WhatsApp Business app on the phone (version 2.24.17 or newer).", "Then try again."],
    metaSide: true,
  },
  regionUnavailable: {
    id: "regionUnavailable",
    title: "Not available for this country yet",
    cause: "Keeping a number on the WhatsApp Business app isn't available for numbers from this region yet.",
    steps: ["Go back and connect it as \"A new number\" instead, or use a number from a supported country."],
    metaSide: false,
  },
  marketingLite: {
    id: "marketingLite",
    title: "This account type can't keep the app",
    cause: "WhatsApp accounts set up for Marketing Messages can't also stay on the WhatsApp Business app.",
    steps: ["Pick a different WhatsApp account in the Facebook window, or connect the number as \"A new number\"."],
    metaSide: true,
  },
  pageLinked: {
    id: "pageLinked",
    title: "This number is linked to a Facebook Page",
    cause: "The number is connected to a Facebook Page, which blocks this setup.",
    steps: ["Remove the WhatsApp link from the Page: business.facebook.com → Settings → Accounts → Pages.", "Then try again."],
    metaSide: true,
  },
  invalidNumber: {
    id: "invalidNumber",
    title: "Facebook didn't accept this number",
    cause: "The number looks invalid to Facebook.",
    steps: ["Check the country code and number, then try again. Or use a different number."],
    metaSide: false,
  },
  accountRestricted: {
    id: "accountRestricted",
    title: "This WhatsApp account is restricted",
    cause: "Facebook has restricted this WhatsApp account or business, separately from this setup.",
    steps: [
      "Open WhatsApp Manager to see the restriction notice and appeal it if you think it's wrong.",
      "Or pick a different WhatsApp account or business and try again.",
    ],
    metaSide: true,
  },
  businessLimit: {
    id: "businessLimit",
    title: "Your business has reached a Facebook limit",
    cause: "The business already has as many WhatsApp accounts or numbers as Facebook allows right now.",
    steps: [
      "Delete an unused WhatsApp account or number in WhatsApp Manager, then try again.",
      "Completing Facebook business verification raises these limits.",
    ],
    metaSide: true,
  },
  verificationElsewhere: {
    id: "verificationElsewhere",
    title: "Business verification is already underway",
    cause: "A business verification request already exists for this business, maybe started earlier or through another provider.",
    steps: ["Let that verification finish (check Security Center in Facebook Business settings), then try again."],
    metaSide: true,
  },
  displayNameRejected: {
    id: "displayNameRejected",
    title: "Facebook didn't accept the display name",
    cause: "The name customers would see in WhatsApp doesn't meet WhatsApp's naming rules.",
    steps: [
      "Use your real business name as it appears on your website or signage. Avoid generic words, extra symbols, or all capitals.",
      "Then try again.",
    ],
    metaSide: false,
  },
  notAdmin: {
    id: "notAdmin",
    title: "You need admin access to that business",
    cause: "The Facebook account you signed in with isn't an admin of the business you picked.",
    steps: [
      "Try again and pick a business where you're an admin.",
      "Or ask an admin of that business to connect WhatsApp, or to make you an admin.",
    ],
    metaSide: true,
  },
  facebookAccountTooNew: {
    id: "facebookAccountTooNew",
    title: "This Facebook account is too new",
    cause: "Facebook limits brand-new accounts from creating business accounts.",
    steps: ["Sign in with an established Facebook account that manages your business, or wait a day and try again."],
    metaSide: true,
  },
  securityCheck: {
    id: "securityCheck",
    title: "Facebook needs a security check",
    cause: "This is a Facebook account security step, not a problem with your WhatsApp setup.",
    steps: [
      "Complete the check Facebook shows, or turn on two-factor authentication in Facebook's Accounts Center.",
      "Then try again, ideally from a device you've used Facebook on before.",
    ],
    metaSide: true,
  },
  slowDown: {
    id: "slowDown",
    title: "Too many attempts",
    cause: "Facebook is limiting how often this can be tried.",
    steps: ["Wait 10–15 minutes before trying again. Retrying sooner restarts the wait."],
    metaSide: true,
  },
  temporary: {
    id: "temporary",
    title: "Facebook hit a temporary problem",
    cause: "Something went wrong on Facebook's side during setup.",
    steps: ["Wait a few minutes and try again.", "If it keeps happening, contact support with the reference below."],
    metaSide: true,
  },
} satisfies Record<string, SignupErrorGuide>

type GuideId = keyof typeof GUIDES

const BY_CODE: Record<string, GuideId> = {
  "2494064": "numberClaimedElsewhere",
  "3441030": "numberClaimedElsewhere",
  "3441049": "connectedToOtherProvider",
  "2655094": "connectedToOtherProvider",
  "2655093": "sharedWithPartner",
  "3441041": "wrongBusiness",
  "2655095": "notOnBusinessApp",
  "2655048": "notOnBusinessApp",
  "3441045": "notEligibleYet",
  "4563015": "updateBusinessApp",
  "3441042": "regionUnavailable",
  "3441047": "marketingLite",
  "2655082": "pageLinked",
  "3441051": "invalidNumber",
  "3441040": "accountRestricted",
  "2655089": "accountRestricted",
  "2388107": "accountRestricted",
  "2494067": "businessLimit",
  "2494030": "verificationElsewhere",
  "2494143": "verificationElsewhere",
  "524126": "displayNameRejected",
  "2859009": "securityCheck",
  "2859043": "securityCheck",
  "2136001": "securityCheck",
  "4612001": "securityCheck",
  "2655091": "securityCheck",
  "3441033": "slowDown",
  "3441046": "slowDown",
  "1390006": "slowDown",
  "1675004": "slowDown",
  "2859015": "slowDown",
  "3441003": "temporary",
  "2655005": "temporary",
  "2593035": "temporary",
}

// Meta documents several of its errors by wording only, with no code.
const BY_MESSAGE: Array<[RegExp, GuideId]> = [
  [/already registered/i, "numberClaimedElsewhere"],
  [/lacks permission|does not have permission/i, "notAdmin"],
  [/account is too new/i, "facebookAccountTooNew"],
  [/limit for the number of businesses|maximum .*(whatsapp business accounts|wabas)|phone number limit/i, "businessLimit"],
  [/violates whatsapp guidelines/i, "displayNameRejected"],
  [/too many (attempts|requests)|too fast/i, "slowDown"],
]

export function guideForSignupError(error: { code?: string; message?: string }): SignupErrorGuide {
  const byCode = error.code ? BY_CODE[error.code] : undefined
  if (byCode) return GUIDES[byCode]
  const byMessage = error.message ? BY_MESSAGE.find(([pattern]) => pattern.test(error.message!)) : undefined
  if (byMessage) return GUIDES[byMessage[1]]
  // Not one we know: Meta's own words beat a guess at the cause.
  return {
    id: "unknown",
    title: "Facebook couldn't finish the setup",
    cause: error.message || GUIDES.temporary.cause,
    steps: GUIDES.temporary.steps,
    metaSide: true,
  }
}

/** The guide for a number Facebook says is already registered, when it sent nothing we could read. */
export const NUMBER_CLAIMED_ELSEWHERE_GUIDE: SignupErrorGuide = GUIDES.numberClaimedElsewhere
