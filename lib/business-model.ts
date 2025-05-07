export interface Business {
  id: string
  name: string
  ownerId: string // User ID of the owner
  status: "active" | "pending" | "inactive"
  createdAt: string
  wabaId?: string // WhatsApp Business Account ID if connected
  phoneNumbers: number
  industry: string
  address?: string
  website?: string
}

// Mock data for demonstration
export const mockBusinesses: Business[] = [
  {
    id: "biz1",
    name: "Acme Corp",
    ownerId: "user1",
    status: "active",
    createdAt: "2023-04-12",
    wabaId: "waba1",
    phoneNumbers: 3,
    industry: "Technology",
    address: "123 Main St",
    website: "https://acme.example.com",
  },
  {
    id: "biz2",
    name: "XYZ Industries",
    ownerId: "user1",
    status: "pending",
    createdAt: "2023-04-10",
    phoneNumbers: 1,
    industry: "Manufacturing",
  },
  {
    id: "biz3",
    name: "ABC Solutions",
    ownerId: "user1",
    status: "active",
    createdAt: "2023-04-08",
    wabaId: "waba2",
    phoneNumbers: 2,
    industry: "Consulting",
    website: "https://abc.example.com",
  },
  {
    id: "biz4",
    name: "Global Services",
    ownerId: "user1",
    status: "active",
    createdAt: "2023-03-15",
    wabaId: "waba3",
    phoneNumbers: 5,
    industry: "Professional Services",
    website: "https://global.example.com",
  },
  {
    id: "biz5",
    name: "Local Shop",
    ownerId: "user2",
    status: "active",
    createdAt: "2023-02-20",
    wabaId: "waba4",
    phoneNumbers: 1,
    industry: "Retail",
  },
  {
    id: "biz6",
    name: "City Restaurant",
    ownerId: "user2",
    status: "inactive",
    createdAt: "2023-01-10",
    phoneNumbers: 1,
    industry: "Food & Beverage",
  },
]

export function getBusinessById(id: string): Business | undefined {
  return mockBusinesses.find((business) => business.id === id)
}

export function getBusinessesByOwnerId(ownerId: string): Business[] {
  return mockBusinesses.filter((business) => business.ownerId === ownerId)
}

export function getAllBusinesses(): Business[] {
  return mockBusinesses
}

export function createBusiness(business: Omit<Business, "id" | "createdAt">): Business {
  const newBusiness: Business = {
    ...business,
    id: `biz${mockBusinesses.length + 1}`,
    createdAt: new Date().toISOString().split("T")[0],
  }

  mockBusinesses.push(newBusiness)
  return newBusiness
}
