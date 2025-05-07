import Cookies from "js-cookie" // If you use js-cookie, otherwise use document.cookie
import { AUTH_ENDPOINTS, FACEBOOK_ENDPOINTS, WHATSAPP_ENDPOINTS } from "@/config/api-config"

// Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: "admin" | "user" | "super_admin"
  }
}

// Error handling
class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

// Base API request function with error handling
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    // Default headers
    let headers :any= {
      "Content-Type": "application/json",
      ...options.headers,
    }

    // Get token from cookies if available
    const token = Cookies.get("authToken")
    if (token) {
      headers = {
        ...headers,
        "Authorization": `Bearer ${token}`,
      }
    }
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    // Parse the JSON response
    const data = await response.json();
    // Handle API errors
    if (!response.ok) {
      throw new ApiError(data.message || "An error occurred", response.status)
    }
    
    return data as ApiResponse<T>
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // Handle network errors
    throw new ApiError(error instanceof Error ? error.message : "Network error", 500)
  }
}

// Auth services
export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  // Make a real API call to the backend
  const response: any = await apiRequest<AuthResponse>(AUTH_ENDPOINTS.LOGIN, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (response?.user) {
    // Store token and user data in cookies
    Cookies.set("authToken", response?.access_token, { expires: 7 }); // expires in 7 days
    Cookies.set("userData", JSON.stringify(response?.user), { expires: 7 });
    return response?.user;
  } else {
    throw new Error(response.error || response.message || "Login failed");
  }
}

export async function loginWithOtp(email: string, otp: string): Promise<AuthResponse> {
  // Simulate API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // For demo purposes, accept any 6-digit OTP
      if (email && otp && otp.length === 6) {
        const isSuperAdmin = email.endsWith("@admin.com")

        resolve({
          success: true,
          data: {
            token: "dummy-jwt-token-" + Math.random().toString(36).substring(2),
            user: {
              id: "user-" + Math.random().toString(36).substring(2),
              name: email.split("@")[0],
              email,
              role: isSuperAdmin ? "super_admin" : "admin",
            },
          },
        } as ApiResponse<AuthResponse>)
      } else {
        reject(new ApiError("Invalid OTP", 401))
      }
    }, 800) // Simulate network delay
  }).then((response: any) => {
    // Store token in localStorage
    if (response.success && response.data.token) {
      localStorage.setItem("authToken", response.data.token)
      localStorage.setItem("userData", JSON.stringify(response.data.user))
    }
    return response.data
  })
}

export async function sendOtp(email: string): Promise<{ success: boolean; message: string }> {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: "OTP sent successfully",
      })
    }, 800) // Simulate network delay
  })
}

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  // Make a real API call to the backend
  const response :any = await apiRequest<any>(AUTH_ENDPOINTS.SIGNUP, {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })

  if (response.id) {
    // localStorage.setItem("authToken", response.data.token)
    localStorage.setItem("userData", JSON.stringify(response.data.user))
    return response.data
  } else {
    throw new Error(response.error || response.message || "Signup failed")
  }
}

export async function logout(): Promise<void> {
  // In a real implementation, this would call the logout API
  // For now, we'll just clear the local storage

  localStorage.removeItem("authToken")
  localStorage.removeItem("userData")

  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, 300)
  })
}

// Function to check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  const token = localStorage.getItem("authToken")
  return !!token
}

// Function to get current user data
export function getCurrentUser() {
  if (typeof window === "undefined") return null

  const userData = localStorage.getItem("userData")
  console.log("userData", userData)
  return userData ? JSON.parse(userData) : null
}

export async function getFacebookLoginUrl(): Promise<any> {
  const response:any = await apiRequest<{ url: string }>("http://localhost:3000/auth/facebook/login-url")
  if (!response.url) {
    throw new Error("Failed to fetch Facebook login URL")
  }
  return response.url
}

export async function handleFacebookCallback(code: string) {
  try {
    // Make an API call to exchange the code for a token
    const response: any = await apiRequest<{ token: string }>(
      "http://localhost:3000/auth/facebook/callback",
      {
        method: "POST",
        body: JSON.stringify({ code }),
      }
    )

    if (!response.data?.token) {
      throw new Error("No token received from Facebook login")
    }

    // Store the token in cookies
    Cookies.set("authToken", response.data.token) // or use document.cookie

    // Optionally, store user data if returned
    if (response.data.user) {
      localStorage.setItem("userData", JSON.stringify(response.data.user))
    }

    return response.data
  } catch (error) {
    console.error("Facebook login failed:", error)
    throw error
  }
}

export function getAuthTokenFromCookie() {
  return Cookies.get("authToken");
}

export function getUserDataFromCookie() {
  const userData = Cookies.get("userData");
  return userData ? JSON.parse(userData) : null;
}

export async function getFacebookAccounts(userId: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.GET_ACCOUNTS(userId))
}

export async function getFacebookBusinessManagers(userId: string, facebookId: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.GET_BUSINESS_MANAGERS(userId, facebookId));
}



export async function setWhatsappBusinessDetails(details: {
  userId: string
  businessId: string
  accountDetails: any
  [key: string]: any // for any additional details
}): Promise<ApiResponse<any>> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.SET_BUSINESS_DETAILS, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function getWhatsappBusinessAccount(wabaId: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.GET_WHATSAPP_BUSINESS_ACCOUNT(wabaId))
}