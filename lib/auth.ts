import { isAuthenticated } from "@/services/api"

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
