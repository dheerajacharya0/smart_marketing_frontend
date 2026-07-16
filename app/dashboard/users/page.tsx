"use client"

import { ResponsiveCard } from "@/components/ui/responsive-card"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, UserPlus } from "lucide-react"
import Link from "next/link"

// Mock data for users
const users = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "Active",
    businesses: 3,
    createdAt: "2023-01-15",
    subscription: "Premium",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "User",
    status: "Active",
    businesses: 1,
    createdAt: "2023-02-20",
    subscription: "Basic",
  },
  {
    id: "3",
    name: "Robert Johnson",
    email: "robert@example.com",
    role: "User",
    status: "Inactive",
    businesses: 0,
    createdAt: "2023-03-10",
    subscription: "Free",
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily@example.com",
    role: "Manager",
    status: "Active",
    businesses: 2,
    createdAt: "2023-04-05",
    subscription: "Premium",
  },
  {
    id: "5",
    name: "Michael Wilson",
    email: "michael@example.com",
    role: "User",
    status: "Pending",
    businesses: 1,
    createdAt: "2023-05-12",
    subscription: "Basic",
  },
]

export default function UsersPage() {
  const columns = [
    {
      header: "Name",
      accessorKey: "name",
    },
    {
      header: "Email",
      accessorKey: "email",
      hideOnMobile: true,
    },
    {
      header: "Role",
      accessorKey: "role",
      hideOnMobile: true,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => {
        const statusMap: Record<string, string> = {
          Active: "bg-green-100 text-green-800",
          Inactive: "bg-gray-100 text-gray-800",
          Pending: "bg-yellow-100 text-yellow-800",
        }
        return (
          <Badge variant="outline" className={statusMap[row.status] || ""}>
            {row.status}
          </Badge>
        )
      },
    },
    {
      header: "Subscription",
      accessorKey: "subscription",
      hideOnMobile: true,
      cell: (row: any) => {
        const subscriptionMap: Record<string, string> = {
          Free: "bg-gray-100 text-gray-800",
          Basic: "bg-blue-100 text-blue-800",
          Premium: "bg-purple-100 text-purple-800",
          Enterprise: "bg-indigo-100 text-indigo-800",
        }
        return (
          <Badge variant="outline" className={subscriptionMap[row.subscription] || ""}>
            {row.subscription}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage your users and their permissions</p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <ResponsiveCard>
        <ResponsiveTable
          data={users}
          columns={columns}
          searchable
          searchPlaceholder="Search users..."
          pagination
          itemsPerPage={10}
          onRowClick={(row) => console.log("Clicked row:", row)}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">No users found</p>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          }
        />
      </ResponsiveCard>
    </div>
  )
}
