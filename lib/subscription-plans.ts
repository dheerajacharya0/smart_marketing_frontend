export type SubscriptionTier = "free" | "basic" | "premium" | "enterprise"

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  description: string
  businessLimit: number
  messageLimit: number
  apiLimit: number
  price: {
    monthly: number
    yearly: number
  }
  features: string[]
}

const subscriptionPlans: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    description: "For individuals just getting started",
    businessLimit: 1,
    messageLimit: 1000,
    apiLimit: 100,
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: ["1 WhatsApp Business Account", "1,000 messages per month", "Basic templates", "Email support"],
  },
  basic: {
    id: "basic",
    name: "Basic",
    description: "For small businesses",
    businessLimit: 3,
    messageLimit: 10000,
    apiLimit: 5000,
    price: {
      monthly: 29,
      yearly: 290,
    },
    features: [
      "3 WhatsApp Business Accounts",
      "10,000 messages per month",
      "Custom templates",
      "Basic API access",
      "Basic analytics",
      "Priority email support",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "For growing businesses",
    businessLimit: 10,
    messageLimit: 50000,
    apiLimit: 25000,
    price: {
      monthly: 79,
      yearly: 790,
    },
    features: [
      "10 WhatsApp Business Accounts",
      "50,000 messages per month",
      "Unlimited templates",
      "Full API access",
      "Advanced analytics",
      "Webhook integrations",
      "Priority phone & email support",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    businessLimit: 50,
    messageLimit: -1, // Unlimited
    apiLimit: -1, // Unlimited
    price: {
      monthly: 199,
      yearly: 1990,
    },
    features: [
      "50 WhatsApp Business Accounts",
      "Unlimited messages",
      "Unlimited templates",
      "Full API access",
      "Advanced analytics & reporting",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 priority support",
    ],
  },
}

export function getSubscriptionPlan(tier: SubscriptionTier): SubscriptionPlan {
  return subscriptionPlans[tier]
}

export function canCreateBusiness(tier: SubscriptionTier, currentCount: number): boolean {
  const plan = subscriptionPlans[tier]
  return currentCount < plan.businessLimit
}

export function getRemainingBusinesses(tier: SubscriptionTier, currentCount: number): number {
  const plan = subscriptionPlans[tier]
  return Math.max(0, plan.businessLimit - currentCount)
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return Object.values(subscriptionPlans)
}
