import { isAuthenticated, getCurrentUser, logout } from "@/services/api"

// Middleware function to check if user is authenticated
export function requireAuth() {
  if (typeof window !== "undefined") {
    const isAuthed = isAuthenticated()

    if (!isAuthed) {
      // Redirect to login page
      window.location.href = "/login"
      return false
    }

    return true
  }

  return false
}

// Middleware function to check if user is a super admin
export function requireSuperAdmin() {
  if (typeof window !== "undefined") {
    const isAuthed = isAuthenticated()

    if (!isAuthed) {
      // Redirect to login page
      window.location.href = "/login"
      return false
    }

    const user = getCurrentUser()

    if (!user || user.role !== "super_admin") {
      // Redirect to dashboard with access denied
      window.location.href = "/dashboard?access=denied"
      return false
    }

    return true
  }

  return false
}

// Function to handle logout
export async function handleLogout() {
  await logout()
  window.location.href = "/login"
}
