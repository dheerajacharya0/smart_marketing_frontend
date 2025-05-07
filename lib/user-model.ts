import type { SubscriptionTier } from "./subscription-plans"

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "user" | "super_admin"
  subscription: {
    tier: SubscriptionTier
    isActive: boolean
    expiresAt: string
  }
  businesses: string[] // IDs of businesses owned by this user
}

// Mock data for demonstration
const users: User[] = [
  {
    id: "user1",
    name: "John Doe",
    email: "john@example.com",
    role: "super_admin",
    subscription: {
      tier: "premium",
      isActive: true,
      expiresAt: "2023-12-31",
    },
    businesses: ["biz1", "biz2", "biz3", "biz4"],
  },
  {
    id: "user2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "admin",
    subscription: {
      tier: "basic",
      isActive: true,
      expiresAt: "2023-11-15",
    },
    businesses: ["biz5", "biz6"],
  },
]

export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id)
}

export function getUserBusinessCount(userId: string): number {
  const user = getUserById(userId)
  return user ? user.businesses.length : 0
}

export function canUserCreateBusiness(userId: string): boolean {
  const user = getUserById(userId)
  if (!user || !user.subscription.isActive) return false

  const businessCount = user.businesses.length
  const { tier } = user.subscription

  // Import would cause circular dependency, so we'll replicate the logic here
  const limits = {
    free: 1,
    basic: 3,
    premium: 10,
    enterprise: 50,
  }

  return businessCount < limits[tier]
}

export function getAllUsers(): User[] {
  return users
}
