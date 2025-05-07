/**
 * API Configuration
 *
 * This file contains all API endpoints used in the application.
 * Replace these dummy URLs with your actual API endpoints when ready.
 */

// Base API URL - replace with your actual API base URL
export const API_BASE_URL = "http://localhost:3000"

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  LOGIN_WITH_OTP: `${API_BASE_URL}/auth/login-otp`,
  SEND_OTP: `${API_BASE_URL}/auth/send-otp`,
  SIGNUP: `${API_BASE_URL}/auth/signup`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh-token`,
}

// User endpoints
export const USER_ENDPOINTS = {
  GET_PROFILE: `${API_BASE_URL}/users/profile`,
  UPDATE_PROFILE: `${API_BASE_URL}/users/profile`,
}

// Super admin specific endpoints
export const ADMIN_ENDPOINTS = {
  GET_USERS: `${API_BASE_URL}/admin/users`,
  GET_USER: (userId: string) => `${API_BASE_URL}/admin/users/${userId}`,
  CREATE_USER: `${API_BASE_URL}/admin/users`,
  UPDATE_USER: (userId: string) => `${API_BASE_URL}/admin/users/${userId}`,
  DELETE_USER: (userId: string) => `${API_BASE_URL}/admin/users/${userId}`,
}

// Facebook endpoints
export const FACEBOOK_ENDPOINTS = {
  GET_ACCOUNTS: (userId: string) => `${API_BASE_URL}/auth/facebook-accounts/${userId}`,
  GET_BUSINESS_MANAGERS: (userId: string, facebookId: string) =>
    `${API_BASE_URL}/business/facebook?userId=${userId}&facebookId=${facebookId}`,
  SET_BUSINESS_DETAILS: `${API_BASE_URL}/business/facebook-business-details`,
  GET_WHATSAPP_BUSINESS_ACCOUNT: (wabaId: string) => `${API_BASE_URL}/business/whatsapp-business-accounts?businessId=${wabaId}`,
}
