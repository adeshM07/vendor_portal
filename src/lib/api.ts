export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://dev.link2build.com/api/v1";

/** Rental service — vendor bookings, extensions, equipment (see dev.link2build.com/rental/rental-docs) */
export const RENTAL_API_BASE_URL =
  process.env.NEXT_PUBLIC_RENTAL_API_BASE_URL ??
  "https://dev.link2build.com/rental/api/v1";

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  message?: string;
}

export type OtpPurpose = "signup" | "login" | "phone_change";

export interface SendOtpPayload {
  phone_country_code?: string;
  phone_number: string;
  purpose: OtpPurpose;
}

export interface SendOtpData {
  resend_in_seconds: number;
  expires_in_seconds: number;
}

export interface VerifyOtpPayload {
  phone_country_code?: string;
  phone_number: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface AuthUser {
  id: string;
  phone_number: string;
  email?: string | null;
  account_type?: string | null;
  onboarding_step: string;
  onboarding_completed: boolean;
  referral_code?: string;
}

export interface VerifyOtpData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Something went wrong. Please try again.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return (body as ApiSuccessBody<T>).data;
}

export async function sendOtp(payload: SendOtpPayload): Promise<SendOtpData> {
  const response = await fetch(`${API_BASE_URL}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_country_code: payload.phone_country_code ?? "+91",
      phone_number: payload.phone_number,
      purpose: payload.purpose,
    }),
  });

  return parseResponse<SendOtpData>(response);
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpData> {
  const response = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_country_code: payload.phone_country_code ?? "+91",
      phone_number: payload.phone_number,
      otp: payload.otp,
      purpose: payload.purpose,
    }),
  });

  return parseResponse<VerifyOtpData>(response);
}
