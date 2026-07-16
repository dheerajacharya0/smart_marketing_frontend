import Cookies from "js-cookie" // If you use js-cookie, otherwise use document.cookie
import { AUTH_ENDPOINTS, FACEBOOK_ENDPOINTS, WHATSAPP_ENDPOINTS, CHAT_ENDPOINTS, AUTOMATION_ENDPOINTS, CONTACTS_ENDPOINTS, CAMPAIGNS_ENDPOINTS, ANALYTICS_ENDPOINTS, SEGMENTS_ENDPOINTS, FLOWS_ENDPOINTS, TEAM_ENDPOINTS, DRIPS_ENDPOINTS, ALERTS_ENDPOINTS } from "@/config/api-config"

export interface WhatsappContext {
  accountId: string
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
}

const ACTIVE_PHONE_NUMBER_KEY = "activeWhatsappPhoneNumberId"

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
export class ApiError extends Error {
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
      // Meta/Graph API errors are sometimes proxied through as-is (error_user_msg/error_user_title),
      // sometimes wrapped under data.error or data.message — prefer the most human-readable field.
      const metaError = data?.error?.error_user_msg
        ? data.error
        : data?.error_user_msg
          ? data
          : null
      const message =
        metaError?.error_user_msg ||
        metaError?.error_user_title ||
        data?.message ||
        data?.error?.message ||
        "An error occurred"
      throw new ApiError(message, response.status)
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

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  // Make a real API call to the backend
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.SIGNUP, {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })

  if (response.id) {
    localStorage.setItem("userData", JSON.stringify(response))
    return response
  } else {
    throw new Error(response.error || response.message || "Signup failed")
  }
}

// Request a password-reset email. Backend always returns 200 (never reveals
// whether the email exists) — we surface a generic success either way.
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return { message: response?.message || "If that email exists, a reset link is on its way." }
}

// Complete a password reset with the token from the emailed link.
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.RESET_PASSWORD, {
    method: "POST",
    body: JSON.stringify({ token, password }),
  })
  return { message: response?.message || "Password updated. You can now sign in." }
}

// Confirm an email address via the token in the verification link.
export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.VERIFY_EMAIL, {
    method: "POST",
    body: JSON.stringify({ token }),
  })
  return { message: response?.message || "Email verified." }
}

// Re-send the verification email to an address that hasn't confirmed yet.
export async function resendVerification(email: string): Promise<{ message: string }> {
  const response: any = await apiRequest<any>(AUTH_ENDPOINTS.RESEND_VERIFICATION, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return { message: response?.message || "Verification email sent." }
}

export async function logout(): Promise<void> {
  // In a real implementation, this would call the logout API
  // For now, we'll just clear the cookies

  Cookies.remove("authToken")
  Cookies.remove("userData")

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

  return !!Cookies.get("authToken")
}

// Function to get current user data
export function getCurrentUser() {
  if (typeof window === "undefined") return null

  const userData = Cookies.get("userData")
  if (!userData) return null
  try {
    return JSON.parse(userData)
  } catch {
    return null
  }
}

export async function getFacebookLoginUrl(): Promise<any> {
  const response: any = await apiRequest<{ url: string }>(AUTH_ENDPOINTS.FACEBOOK_LOGIN_URL)
  if (!response.url) {
    throw new Error("Failed to fetch Facebook login URL")
  }
  return response.url
}

// Facebook-connect exchanges the OAuth code for a linked Account, not an app
// access_token — app auth only ever comes from loginWithEmail. Requires an
// existing authToken (apiRequest attaches it automatically); the backend 401s
// otherwise rather than silently creating/merging an account by email. Store the
// returned user under userData; do not touch authToken here.
export async function handleFacebookCallback(code: string) {
  try {
    const response: any = await apiRequest<any>(AUTH_ENDPOINTS.FACEBOOK_CALLBACK, {
      method: "POST",
      body: JSON.stringify({ code }),
    })

    if (!response.id) {
      throw new Error("No user received from Facebook login")
    }

    Cookies.set("userData", JSON.stringify(response), { expires: 7 })

    return response
  } catch (error) {
    console.error("Facebook login failed:", error)
    throw error
  }
}

export function getAuthTokenFromCookie() {
  return Cookies.get("authToken");
}

export function getUserDataFromCookie() {
  // signup() only writes userData to localStorage, not the cookie, so fall
  // back to it — otherwise a signed-up-but-never-logged-in session looks
  // unauthenticated to every caller that reads this (chat history, etc).
  const userData = Cookies.get("userData") || (typeof window !== "undefined" ? localStorage.getItem("userData") : null);
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

export async function getFacebookAccounts(userId: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.GET_ACCOUNTS(userId))
}

export async function getFacebookBusinessManagers(userId: string, facebookId: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.GET_BUSINESS_MANAGERS(userId, facebookId));
}



export async function setWhatsappBusinessDetails(details: {
  accountId: string
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

export async function syncBusiness(accountId?: string): Promise<any> {
  return apiRequest<any>(FACEBOOK_ENDPOINTS.SYNC_BUSINESS(accountId), {
    method: "POST",
  })
}

export async function addWhatsappPhoneNumber(details: {
  accountId: string
  wabaId: string
  phoneNumber: string
  verifiedName: string
  cc?: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.ADD_PHONE_NUMBER, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listWhatsappPhoneNumbers(accountId: string): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.LIST_PHONE_NUMBERS(accountId))
}

export async function requestWhatsappVerificationCode(details: {
  accountId: string
  phoneNumberId: string
  codeMethod: "SMS" | "VOICE"
  language?: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.REQUEST_CODE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function verifyWhatsappCode(details: {
  accountId: string
  phoneNumberId: string
  code: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.VERIFY_CODE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function registerWhatsappPhone(details: {
  accountId: string
  wabaId: string
  phoneNumberId: string
  pin: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.REGISTER, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function subscribeWhatsappWaba(details: {
  accountId: string
  wabaId: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.SUBSCRIBE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function sendWhatsappMessage(details: {
  accountId: string
  phoneNumberId: string
  to: string
  message: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.SEND, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export type WhatsappMediaType = "image" | "video" | "audio" | "document" | "sticker"

// Either link (public URL) or mediaId — exactly one. caption only for
// image/video/document; filename only for document.
export async function sendWhatsappMedia(details: {
  accountId: string
  phoneNumberId: string
  to: string
  type: WhatsappMediaType
  link?: string
  mediaId?: string
  caption?: string
  filename?: string
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.SEND_MEDIA, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export interface InteractiveButtonsInput {
  kind: "buttons"
  bodyText: string
  headerText?: string
  footerText?: string
  buttons: { id: string; title: string }[]
}

export interface InteractiveListInput {
  kind: "list"
  bodyText: string
  headerText?: string
  footerText?: string
  buttonText: string
  sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
}

export type InteractiveInput = InteractiveButtonsInput | InteractiveListInput

export async function sendWhatsappInteractive(details: {
  accountId: string
  phoneNumberId: string
  to: string
} & InteractiveInput): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.SEND_INTERACTIVE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function getWhatsappMediaMetadata(mediaId: string, accountId: string): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.MEDIA_METADATA(mediaId, accountId))
}

// Raw media bytes via the authenticated download proxy — the metadata `url`
// and payload URLs are Meta lookaside links the browser can't fetch directly.
export async function fetchWhatsappMediaBlob(mediaId: string, accountId: string): Promise<Blob> {
  const token = Cookies.get("authToken")
  const response = await fetch(WHATSAPP_ENDPOINTS.MEDIA_DOWNLOAD(mediaId, accountId), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) {
    throw new ApiError("Media no longer available", response.status)
  }
  return response.blob()
}

export async function sendWhatsappTemplate(details: {
  accountId: string
  phoneNumberId: string
  to: string
  templateName: string
  languageCode: string
  components?: any[]
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.SEND_TEMPLATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function createWhatsappTemplate(details: {
  accountId: string
  wabaId: string
  template: {
    name: string
    category: string
    language: string
    components: any[]
  }
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.TEMPLATES, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function updateWhatsappTemplate(
  templateId: string,
  details: {
    accountId: string
    category?: string
    components: any[]
  }
): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.UPDATE_TEMPLATE(templateId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function listWhatsappTemplates(accountId: string, wabaId: string): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.LIST_TEMPLATES(accountId, wabaId))
}

export interface GeneratedTemplateVariable {
  position: number
  name: string
  example: string
}

export interface GeneratedTemplateCompliance {
  passed: boolean
  riskLevel: "low" | "medium" | "high"
  notes: string[]
}

export interface GeneratedTemplate {
  tone: "professional" | "casual" | "promotional"
  name: string
  category: "UTILITY" | "MARKETING"
  language: string
  body: string
  variables: GeneratedTemplateVariable[]
  compliance: GeneratedTemplateCompliance
  components: any[]
}

export interface GenerateTemplatesResponse {
  providers: { draft: string; review: string }
  templates: GeneratedTemplate[]
}

export async function generateWhatsappTemplates(details: {
  accountId: string
  wabaId: string
  prompt: string
  provider?: "anthropic" | "gemini"
}): Promise<any> {
  return apiRequest<GenerateTemplatesResponse>(WHATSAPP_ENDPOINTS.GENERATE_TEMPLATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function deleteWhatsappTemplate(name: string, accountId: string, wabaId: string): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.DELETE_TEMPLATE(name, accountId, wabaId), {
    method: "DELETE",
  })
}

// Chat inbox
export interface ConversationFilters {
  assigneeId?: string
  unassigned?: boolean
  label?: string
}

export async function getChatConversations(
  accountId: string,
  filters?: ConversationFilters
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.LIST_CONVERSATIONS(accountId, filters))
}

export async function assignConversation(
  conversationId: string,
  accountId: string,
  assigneeId: string
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.ASSIGN(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, assigneeId }),
  })
}

export async function unassignConversation(conversationId: string, accountId: string): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.UNASSIGN(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Labels are stored lowercased server-side — send raw.
export async function addConversationLabel(
  conversationId: string,
  accountId: string,
  label: string
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.ADD_LABEL(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, label }),
  })
}

export async function removeConversationLabel(
  conversationId: string,
  accountId: string,
  label: string
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.REMOVE_LABEL(conversationId, label, accountId), {
    method: "DELETE",
  })
}

export interface ConversationNote {
  id: string
  conversationId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export async function getConversationNotes(conversationId: string, accountId: string): Promise<any> {
  return apiRequest<ConversationNote[]>(CHAT_ENDPOINTS.LIST_NOTES(conversationId, accountId))
}

export async function addConversationNote(
  conversationId: string,
  accountId: string,
  body: string
): Promise<any> {
  return apiRequest<ConversationNote>(CHAT_ENDPOINTS.ADD_NOTE(conversationId), {
    method: "POST",
    body: JSON.stringify({ accountId, body }),
  })
}

export async function deleteConversationNote(
  conversationId: string,
  accountId: string,
  noteId: string
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.DELETE_NOTE(conversationId, noteId, accountId), {
    method: "DELETE",
  })
}

// Team management
export type TeamRole = "owner" | "admin" | "agent"

export interface TeamOwner {
  userId: string
  name: string
  email: string
  role: "owner"
}

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  role: "admin" | "agent"
  createdAt: string
}

export interface TeamMembersResponse {
  owner: TeamOwner | null
  members: TeamMember[]
}

export async function getTeamMembers(accountId: string): Promise<any> {
  return apiRequest<TeamMembersResponse>(TEAM_ENDPOINTS.LIST_MEMBERS(accountId))
}

export async function addTeamMember(
  accountId: string,
  email: string,
  role: "admin" | "agent" = "agent"
): Promise<any> {
  return apiRequest<TeamMember>(TEAM_ENDPOINTS.ADD_MEMBER, {
    method: "POST",
    body: JSON.stringify({ accountId, email, role }),
  })
}

export async function updateTeamMemberRole(
  memberId: string,
  accountId: string,
  role: "admin" | "agent"
): Promise<any> {
  return apiRequest<{ id: string; role: string }>(TEAM_ENDPOINTS.UPDATE_MEMBER(memberId), {
    method: "PATCH",
    body: JSON.stringify({ accountId, role }),
  })
}

export async function deleteTeamMember(memberId: string, accountId: string): Promise<any> {
  return apiRequest<{ success: boolean }>(TEAM_ENDPOINTS.DELETE_MEMBER(memberId, accountId), {
    method: "DELETE",
  })
}

export async function getChatMessages(
  conversationId: string,
  accountId: string,
  before?: string,
  limit?: number
): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.LIST_MESSAGES(conversationId, accountId, before, limit))
}

export async function markChatConversationRead(conversationId: string, accountId: string): Promise<any> {
  return apiRequest<any>(CHAT_ENDPOINTS.MARK_READ(conversationId, accountId), {
    method: "POST",
  })
}

// Automation rules
export interface AutomationRuleDetails {
  accountId: string
  wabaId: string
  phoneNumberId: string
  name: string
  matchType: "exact" | "contains" | "any"
  keywords: string[]
  isActive: boolean
  replyType: "text" | "template"
  replyText?: string
  replyTemplateName?: string
  replyTemplateLanguage?: string
  priority: number
}

export async function createAutomationRule(details: AutomationRuleDetails): Promise<any> {
  return apiRequest<any>(AUTOMATION_ENDPOINTS.CREATE_RULE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listAutomationRules(accountId: string): Promise<any> {
  return apiRequest<any>(AUTOMATION_ENDPOINTS.LIST_RULES(accountId))
}

export async function updateAutomationRule(
  ruleId: string,
  details: { accountId: string } & Partial<Omit<AutomationRuleDetails, "accountId">>
): Promise<any> {
  return apiRequest<any>(AUTOMATION_ENDPOINTS.UPDATE_RULE(ruleId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteAutomationRule(ruleId: string, accountId: string): Promise<any> {
  return apiRequest<any>(AUTOMATION_ENDPOINTS.DELETE_RULE(ruleId, accountId), {
    method: "DELETE",
  })
}

// Analytics
export interface AnalyticsRates {
  deliveryRate: number
  readRate: number
  replyRate: number
  failureRate: number
}

export interface AnalyticsOverview {
  range: { from: string; to: string }
  campaigns: {
    total: number
    byStatus: { scheduled: number; running: number; completed: number; cancelled: number }
  }
  recipients: {
    totalRecipients: number
    sentCount: number
    deliveredCount: number
    readCount: number
    failedCount: number
    skippedCount: number
    repliedCount: number
  }
  rates: AnalyticsRates
  messaging: { inbound: number; outbound: number }
}

export interface CampaignTimelinePoint {
  bucket: string
  sent: number
  delivered: number
  read: number
  replied: number
}

export interface CampaignAnalytics {
  campaign: Campaign
  rates: AnalyticsRates
  interval: "hour" | "day"
  timeline: CampaignTimelinePoint[]
}

export interface MessagingPoint {
  bucket: string
  inbound: number
  outbound: number
}

export interface MessagingAnalytics {
  range: { from: string; to: string }
  interval: "hour" | "day"
  points: MessagingPoint[]
}

export async function getAnalyticsOverview(accountId: string, from?: string, to?: string): Promise<any> {
  return apiRequest<AnalyticsOverview>(ANALYTICS_ENDPOINTS.OVERVIEW(accountId, from, to))
}

export async function getCampaignAnalytics(
  campaignId: string,
  accountId: string,
  interval?: "hour" | "day"
): Promise<any> {
  return apiRequest<CampaignAnalytics>(ANALYTICS_ENDPOINTS.CAMPAIGN(campaignId, accountId, interval))
}

export async function getMessagingAnalytics(
  accountId: string,
  from?: string,
  to?: string,
  interval?: "hour" | "day"
): Promise<any> {
  return apiRequest<MessagingAnalytics>(ANALYTICS_ENDPOINTS.MESSAGING(accountId, from, to, interval))
}

// Drip sequences
export interface DripStep {
  delayHours: number
  templateName: string
  templateLanguage: string
  templateParameters?: string[]
}

export interface DripSequence {
  id: string
  name: string
  description: string | null
  phoneNumberId: string
  wabaId: string
  triggerType: "manual" | "tag"
  triggerTag: string | null
  isActive: boolean
  steps: DripStep[]
  enrollments?: { active: number; completed: number }
  createdAt: string
  updatedAt: string
}

export type DripEnrollmentStatus = "active" | "completed" | "cancelled" | "stopped"

export interface DripEnrollment {
  id: string
  contactId: string
  waId: string
  conversationId?: string | null
  currentStepIndex: number
  nextStepAt: string | null
  status: DripEnrollmentStatus
  sentCount: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface DripDetails {
  accountId: string
  phoneNumberId: string
  wabaId: string
  name: string
  description?: string
  triggerType: "manual" | "tag"
  triggerTag?: string
  isActive?: boolean
  steps: DripStep[]
}

export async function createDrip(details: DripDetails): Promise<any> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listDrips(accountId: string): Promise<any> {
  return apiRequest<DripSequence[]>(DRIPS_ENDPOINTS.LIST(accountId))
}

export async function getDrip(dripId: string, accountId: string): Promise<any> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.GET(dripId, accountId))
}

export async function updateDrip(
  dripId: string,
  details: { accountId: string } & Partial<Omit<DripDetails, "accountId">>
): Promise<any> {
  return apiRequest<DripSequence>(DRIPS_ENDPOINTS.UPDATE(dripId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteDrip(dripId: string, accountId: string): Promise<any> {
  return apiRequest<any>(DRIPS_ENDPOINTS.DELETE(dripId, accountId), {
    method: "DELETE",
  })
}

// Enrolls specific contacts and/or all opted-in contacts of a tag. Backend
// skips contacts not opted in or already actively enrolled → skipped count.
export async function enrollDripContacts(
  dripId: string,
  accountId: string,
  payload: { contactIds?: string[]; tag?: string }
): Promise<any> {
  return apiRequest<{ enrolled: number; skipped: number }>(DRIPS_ENDPOINTS.ENROLL(dripId), {
    method: "POST",
    body: JSON.stringify({ accountId, ...payload }),
  })
}

export async function listDripEnrollments(
  dripId: string,
  accountId: string,
  filters: { status?: DripEnrollmentStatus; limit?: number; offset?: number } = {}
): Promise<any> {
  return apiRequest<{ items: DripEnrollment[]; total: number }>(
    DRIPS_ENDPOINTS.ENROLLMENTS({ dripId, accountId, ...filters })
  )
}

export async function cancelDripEnrollment(
  dripId: string,
  enrollmentId: string,
  accountId: string
): Promise<any> {
  return apiRequest<any>(DRIPS_ENDPOINTS.CANCEL_ENROLLMENT(dripId, enrollmentId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Quality / health alerts (backend AlertsModule — raised from
// phone_number_quality_update webhooks when a number's quality degrades)
export interface QualityAlert {
  id: string
  accountId?: string | null
  wabaId?: string | null
  phoneNumberId?: string | null
  displayPhoneNumber?: string | null
  oldRating?: string | null
  newRating: string
  tier?: string | null
  reason?: string | null
  acknowledged: boolean
  createdAt: string
}

export async function listAlerts(
  accountId: string,
  unacknowledgedOnly = false
): Promise<any> {
  return apiRequest<QualityAlert[]>(ALERTS_ENDPOINTS.LIST(accountId, unacknowledgedOnly))
}

export async function acknowledgeAlert(alertId: string, accountId: string): Promise<any> {
  return apiRequest<QualityAlert>(ALERTS_ENDPOINTS.ACK(alertId, accountId), {
    method: "POST",
  })
}

// Chatbot flows
export type FlowNode =
  | { id: string; type: "message"; text: string; next?: string }
  | {
      id: string
      type: "buttons"
      text: string
      buttons: { title: string; next?: string }[]
      fallbackNext?: string
    }
  | { id: string; type: "question"; text: string; variable: string; next?: string }
  | { id: string; type: "handoff"; text?: string }
  | { id: string; type: "end"; text?: string }

export interface FlowDefinition {
  entryNodeId: string
  nodes: FlowNode[]
}

export interface Flow {
  id: string
  name: string
  description: string | null
  phoneNumberId: string
  triggerMatchType: "exact" | "contains" | "any"
  triggerKeywords: string[]
  isActive: boolean
  priority: number
  definition: FlowDefinition
  createdAt: string
  updatedAt: string
}

export interface FlowSession {
  id: string
  contactWaId: string
  conversationId?: string | null
  currentNodeId: string | null
  variables: Record<string, string>
  status: "active" | "completed" | "handed_off"
  createdAt: string
  updatedAt: string
}

export interface FlowDetails {
  accountId: string
  phoneNumberId: string
  name: string
  description?: string
  triggerMatchType: "exact" | "contains" | "any"
  triggerKeywords?: string[]
  isActive?: boolean
  priority?: number
  definition: FlowDefinition
}

export async function createFlow(details: FlowDetails): Promise<any> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listFlows(accountId: string): Promise<any> {
  return apiRequest<Flow[]>(FLOWS_ENDPOINTS.LIST(accountId))
}

export async function getFlow(flowId: string, accountId: string): Promise<any> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.GET(flowId, accountId))
}

export async function updateFlow(
  flowId: string,
  details: { accountId: string } & Partial<Omit<FlowDetails, "accountId">>
): Promise<any> {
  return apiRequest<Flow>(FLOWS_ENDPOINTS.UPDATE(flowId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteFlow(flowId: string, accountId: string): Promise<any> {
  return apiRequest<any>(FLOWS_ENDPOINTS.DELETE(flowId, accountId), {
    method: "DELETE",
  })
}

export async function listFlowSessions(
  flowId: string,
  accountId: string,
  filters: { status?: FlowSession["status"]; limit?: number; offset?: number } = {}
): Promise<any> {
  return apiRequest<{ items: FlowSession[]; total: number }>(
    FLOWS_ENDPOINTS.SESSIONS({ flowId, accountId, ...filters })
  )
}

// Segments (saved audience filters, evaluated live server-side)
export type SegmentCondition =
  | { type: "field"; field: "name" | "waId"; operator: "equals" | "not_equals" | "contains" | "starts_with"; value: string }
  | { type: "field"; field: "optedIn"; operator: "is_true" | "is_false" }
  | { type: "field"; field: "createdAt"; operator: "before" | "after"; value: string }
  | { type: "attribute"; key: string; operator: "equals" | "not_equals" | "contains"; value: string }
  | { type: "attribute"; key: string; operator: "exists" | "not_exists" }
  | { type: "tag"; operator: "has" | "not_has"; value: string }
  | { type: "activity"; operator: "active_within" | "inactive_within"; days: number }
  | {
      type: "campaign"
      event: "received" | "read" | "replied"
      operator: "within" | "not_within"
      days: number
      campaignId?: string
    }

export interface SegmentRules {
  combinator: "and" | "or"
  conditions: SegmentCondition[]
}

export interface Segment {
  id: string
  name: string
  description: string | null
  rules: SegmentRules
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface SegmentPreviewResult {
  total: number
  sample: Contact[]
}

export async function createSegment(details: {
  accountId: string
  name: string
  description?: string
  rules: SegmentRules
}): Promise<any> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listSegments(accountId: string): Promise<any> {
  return apiRequest<Segment[]>(SEGMENTS_ENDPOINTS.LIST(accountId))
}

export async function getSegment(segmentId: string, accountId: string): Promise<any> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.GET(segmentId, accountId))
}

export async function listSegmentContacts(
  segmentId: string,
  accountId: string,
  limit?: number,
  offset?: number
): Promise<any> {
  return apiRequest<ContactListResponse>(SEGMENTS_ENDPOINTS.CONTACTS(segmentId, accountId, limit, offset))
}

export async function updateSegment(
  segmentId: string,
  details: { accountId: string; name?: string; description?: string; rules?: SegmentRules }
): Promise<any> {
  return apiRequest<Segment>(SEGMENTS_ENDPOINTS.UPDATE(segmentId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteSegment(segmentId: string, accountId: string): Promise<any> {
  return apiRequest<any>(SEGMENTS_ENDPOINTS.DELETE(segmentId, accountId), {
    method: "DELETE",
  })
}

// Evaluates rules without saving — powers the live builder preview.
export async function previewSegment(accountId: string, rules: SegmentRules, limit?: number): Promise<any> {
  return apiRequest<SegmentPreviewResult>(SEGMENTS_ENDPOINTS.PREVIEW, {
    method: "POST",
    body: JSON.stringify({ accountId, rules, ...(limit != null ? { limit } : {}) }),
  })
}

// Broadcast campaigns
export type CampaignStatus = "scheduled" | "running" | "completed" | "cancelled"

export type CampaignRecipientStatus = "pending" | "sent" | "delivered" | "read" | "failed" | "skipped"

export interface Campaign {
  id: string
  name: string
  wabaId: string
  phoneNumberId: string
  templateName: string
  templateLanguage: string
  templateParameters: string[]
  audienceTag: string | null
  segmentId?: string | null
  status: CampaignStatus
  scheduledAt: string | null
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  skippedCount: number
  repliedCount?: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignRecipient {
  id: string
  contactId: string
  waId: string
  contactName: string | null
  status: CampaignRecipientStatus
  error: string | null
  attempts: number
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  repliedAt?: string | null
}

export interface CampaignRecipientListResponse {
  items: CampaignRecipient[]
  total: number
  limit: number
  offset: number
}

export async function createCampaign(details: {
  accountId: string
  wabaId: string
  phoneNumberId: string
  name: string
  templateName: string
  templateLanguage: string
  templateParameters?: string[]
  // audienceTag and segmentId are mutually exclusive (400 if both)
  audienceTag?: string
  segmentId?: string
  scheduledAt?: string
}): Promise<any> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

export async function listCampaigns(accountId: string): Promise<any> {
  return apiRequest<Campaign[]>(CAMPAIGNS_ENDPOINTS.LIST(accountId))
}

export async function getCampaign(campaignId: string, accountId: string): Promise<any> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.GET(campaignId, accountId))
}

export async function listCampaignRecipients(
  campaignId: string,
  accountId: string,
  filters: { status?: CampaignRecipientStatus; limit?: number; offset?: number } = {}
): Promise<any> {
  return apiRequest<CampaignRecipientListResponse>(
    CAMPAIGNS_ENDPOINTS.RECIPIENTS({ campaignId, accountId, ...filters })
  )
}

export async function cancelCampaign(campaignId: string, accountId: string): Promise<any> {
  return apiRequest<Campaign>(CAMPAIGNS_ENDPOINTS.CANCEL(campaignId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// Contacts (CRM)
export interface Contact {
  id: string
  waId: string
  name: string | null
  tags: string[]
  attributes: Record<string, string>
  optedIn: boolean
  optedInAt: string | null
  optedOutAt: string | null
  optInSource: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
  limit: number
  offset: number
}

export interface ContactImportResult {
  total: number
  created: number
  updated: number
  skipped: { line: number; reason: string }[]
}

export interface ContactListFilters {
  tag?: string
  search?: string
  optedIn?: boolean
  limit?: number
  offset?: number
}

export async function listContacts(accountId: string, filters: ContactListFilters = {}): Promise<any> {
  return apiRequest<ContactListResponse>(CONTACTS_ENDPOINTS.LIST({ accountId, ...filters }))
}

// Distinct custom-attribute keys across all contacts (backend does the DISTINCT
// server-side — complete + cheap, unlike deriving from a contact sample).
export async function getContactAttributeKeys(accountId: string): Promise<any> {
  return apiRequest<string[]>(CONTACTS_ENDPOINTS.ATTRIBUTE_KEYS(accountId))
}

export async function createContact(details: {
  accountId: string
  waId: string
  name?: string
  tags?: string[]
  attributes?: Record<string, string>
  optedIn?: boolean
}): Promise<any> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.CREATE, {
    method: "POST",
    body: JSON.stringify(details),
  })
}

// tags/attributes are full replacements on the backend, not merges
export async function updateContact(
  contactId: string,
  details: {
    accountId: string
    name?: string
    tags?: string[]
    attributes?: Record<string, string>
  }
): Promise<any> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.UPDATE(contactId), {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export async function deleteContact(contactId: string, accountId: string): Promise<any> {
  return apiRequest<any>(CONTACTS_ENDPOINTS.DELETE(contactId, accountId), {
    method: "DELETE",
  })
}

export async function optInContact(contactId: string, accountId: string, source = "manual"): Promise<any> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.OPT_IN(contactId), {
    method: "POST",
    body: JSON.stringify({ accountId, source }),
  })
}

export async function optOutContact(contactId: string, accountId: string): Promise<any> {
  return apiRequest<Contact>(CONTACTS_ENDPOINTS.OPT_OUT(contactId), {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })
}

// CSV is sent as plain text in the JSON body (no multipart) — read the file
// client-side with FileReader before calling this.
export async function importContactsCsv(accountId: string, csv: string): Promise<any> {
  return apiRequest<ContactImportResult>(CONTACTS_ENDPOINTS.IMPORT, {
    method: "POST",
    body: JSON.stringify({ accountId, csv }),
  })
}

export async function getWhatsappConversationalAutomation(
  accountId: string,
  phoneNumberId: string
): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.CONVERSATIONAL_AUTOMATION(accountId, phoneNumberId))
}

export async function updateWhatsappConversationalAutomation(details: {
  accountId: string
  phoneNumberId: string
  enableWelcomeMessage: boolean
  prompts: string[]
  commands: { commandName: string; commandDescription: string }[]
}): Promise<any> {
  return apiRequest<any>(WHATSAPP_ENDPOINTS.CONVERSATIONAL_AUTOMATION(details.accountId, details.phoneNumberId), {
    method: "POST",
    body: JSON.stringify(details),
  })
}

// Lists every WhatsApp number the user has actually completed registration
// for, across all of their linked Facebook accounts. Backed by our own DB
// (fast, no live Graph round-trip) rather than the live Meta WABA list used
// during onboarding.
export async function getAvailableWhatsappContexts(userId: string): Promise<WhatsappContext[]> {
  const accountsRes: any = await getFacebookAccounts(userId)
  const accounts = Array.isArray(accountsRes) ? accountsRes : accountsRes?.data
  const facebookAccounts = (accounts || []).filter((a: any) => a.type === "facebook")

  const perAccount = await Promise.all(
    facebookAccounts.map(async (account: any) => {
      try {
        const res: any = await listWhatsappPhoneNumbers(account.id)
        const numbers = Array.isArray(res) ? res : res?.data
        return (numbers || [])
          .filter((n: any) => n.status === "registered")
          .map((n: any) => ({
            accountId: account.id,
            wabaId: n.wabaId,
            phoneNumberId: n.phoneNumberId,
            displayPhoneNumber: n.displayPhoneNumber,
            verifiedName: n.verifiedName,
          }))
      } catch {
        return []
      }
    })
  )

  return perAccount.flat()
}

export function getActiveWhatsappPhoneNumberId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_PHONE_NUMBER_KEY)
}

export function setActiveWhatsappPhoneNumberId(phoneNumberId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_PHONE_NUMBER_KEY, phoneNumberId)
}

// Resolves which WhatsApp number is "active" for chat/templates: the user's
// last-picked number if it's still registered, otherwise falls back to the
// first available one (and persists that as the new pick).
export async function getActiveWhatsappContext(userId: string): Promise<WhatsappContext | null> {
  const contexts = await getAvailableWhatsappContexts(userId)
  if (contexts.length === 0) return null

  const savedId = getActiveWhatsappPhoneNumberId()
  const active = (savedId && contexts.find((c) => c.phoneNumberId === savedId)) || contexts[0]
  setActiveWhatsappPhoneNumberId(active.phoneNumberId)
  return active
}