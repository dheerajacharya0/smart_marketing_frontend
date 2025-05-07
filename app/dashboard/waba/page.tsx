"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"

// Mock data for WABAs
const wabas = [
  {
    id: "waba1",
    name: "Acme Inc",
    businessId: "123456789",
    status: "verified",
    phoneNumbers: 5,
    owner: "John Doe",
    createdAt: "2023-04-12",
  },
  {
    id: "waba2",
    name: "XYZ Corp",
    businessId: "987654321",
    status: "pending",
    phoneNumbers: 2,
    owner: "Jane Smith",
    createdAt: "2023-04-10",
  },
  {
    id: "waba3",
    name: "ABC Ltd",
    businessId: "456789123",
    status: "verified",
    phoneNumbers: 3,
    owner: "Bob Johnson",
    createdAt: "2023-04-08",
  },
  {
    id: "waba4",
    name: "123 Industries",
    businessId: "789123456",
    status: "rejected",
    phoneNumbers: 0,
    owner: "Alice Brown",
    createdAt: "2023-04-05",
  },
  {
    id: "waba5",
    name: "Tech Solutions",
    businessId: "321654987",
    status: "verified",
    phoneNumbers: 7,
    owner: "Charlie Wilson",
    createdAt: "2023-04-03",
  },
  {
    id: "waba6",
    name: "Global Services",
    businessId: "654987321",
    status: "pending",
    phoneNumbers: 1,
    owner: "Diana Prince",
    createdAt: "2023-04-01",
  },
]

export default function WABAPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Filter WABAs based on search term and filters
  const filteredWabas = wabas.filter(waba => {
    const matchesSearch = 
      waba.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      waba.businessId.includes(searchTerm) ||
      waba.owner.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || waba.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "verified": return "default"
      case "pending": return "outline"
      case "rejected": return "destructive"
      default: return "outline"
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">WhatsApp Business Accounts</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => router.push("/dashboard/waba/new")}>
            <Plus className="mr-2 h-4 w-4" /> Register WABA
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>WABA Management</CardTitle>
          <CardDescription>
            Manage WhatsApp Business Accounts and their phone numbers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by name, business ID, or owner"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 w-full md:w-64"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2 w-full md:w-48"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Business ID</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Phone Numbers</th>
                  <th className="px-4 py-2 text-left">Owner</th>
                  <th className="px-4 py-2 text-left">Created At</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredWabas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted-foreground">
                      No WhatsApp Business Accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredWabas.map(waba => (
                    <tr key={waba.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{waba.name}</td>
                      <td className="px-4 py-2">{waba.businessId}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            waba.status === "verified"
                              ? "bg-green-100 text-green-800"
                              : waba.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {waba.status.charAt(0).toUpperCase() + waba.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{waba.phoneNumbers}</td>
                      <td className="px-4 py-2">{waba.owner}</td>
                      <td className="px-4 py-2">{waba.createdAt}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/waba/${waba.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
