"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Phone, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { OtpInput } from "./OtpInput";
import { consumeSessionExpiredMessage, setVendorSession } from "@/lib/auth";
import { ApiRequestError, sendOtp, verifyOtp, type OtpPurpose } from "@/lib/api";
import {
  formatMaterialVendorLoginHint,
  isMaterialVendorTestPhone,
  isRentalVendorTestPhone,
  MATERIAL_VENDOR_FIXED_OTP,
  MATERIAL_VENDOR_OTP_LENGTH,
  MATERIAL_VENDOR_PHONE_RANGE,
  otpRetryAfterSeconds,
  RENTAL_VENDOR_FIXED_OTP,
  RENTAL_VENDOR_PHONE_RANGE,
} from "@/lib/material-vendor-auth";

type LoginStep = "mobile" | "otp";

/** Backend auth OTP length for standard login. Material dev phones use MATERIAL_VENDOR_OTP_LENGTH. */
const AUTH_OTP_LENGTH = 4;

export function LoginCard() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("login");

  const normalizedMobile = mobile.replace(/\s/g, "");
  const isDevMaterialVendor = isMaterialVendorTestPhone(normalizedMobile);
  const isDevRentalVendor = isRentalVendorTestPhone(normalizedMobile);
  const isDevFixedOtpPhone = isDevMaterialVendor || isDevRentalVendor;
  const devFixedOtp = isDevMaterialVendor
    ? MATERIAL_VENDOR_FIXED_OTP
    : isDevRentalVendor
      ? RENTAL_VENDOR_FIXED_OTP
      : null;
  const isValidMobile = /^\d{10}$/.test(normalizedMobile);
  const otpLength = isDevMaterialVendor ? MATERIAL_VENDOR_OTP_LENGTH : AUTH_OTP_LENGTH;
  const isValidOtp = otp.length === otpLength;

  useEffect(() => {
    const expiredMessage = consumeSessionExpiredMessage();
    if (expiredMessage) {
      setError(expiredMessage);
    }
  }, []);

  const goToOtpStep = (purpose: OtpPurpose, message = "") => {
    setOtpPurpose(purpose);
    setStep("otp");
    setInfo(message);
    setError("");
  };

  const handleSendOtp = async () => {
    if (!isValidMobile) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setInfo("");
    setIsLoading(true);

    try {
      await sendOtp({
        phone_number: normalizedMobile,
        purpose: "login",
      });
      goToOtpStep("login");
    } catch (err) {
      if (!(err instanceof ApiRequestError)) {
        setError("Unable to send OTP. Please check your connection and try again.");
        return;
      }

      if (isDevFixedOtpPhone && err.code === "RATE_LIMITED") {
        const devOtp = isDevMaterialVendor
          ? MATERIAL_VENDOR_FIXED_OTP
          : RENTAL_VENDOR_FIXED_OTP;
        const retrySeconds = otpRetryAfterSeconds(err);
        goToOtpStep(
          "login",
          retrySeconds
            ? `OTP was already sent. Wait ${retrySeconds}s or enter the dev OTP ${devOtp} now.`
            : `OTP was already sent. Enter the dev OTP ${devOtp}.`
        );
        return;
      }

      if (err.status === 404 && !isDevFixedOtpPhone) {
        try {
          await sendOtp({
            phone_number: normalizedMobile,
            purpose: "signup",
          });
          goToOtpStep("signup");
          return;
        } catch (signupErr) {
          setError(
            signupErr instanceof ApiRequestError
              ? signupErr.message
              : "Unable to send OTP. Please try again."
          );
          return;
        }
      }

      if (isDevMaterialVendor) {
        setError(`${err.message} ${formatMaterialVendorLoginHint()}`);
        return;
      }

      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!isValidOtp) {
      setError(`Please enter the complete ${otpLength}-digit OTP.`);
      return;
    }
    setError("");
    setInfo("");
    setIsLoading(true);

    const purposes: OtpPurpose[] = isDevMaterialVendor
      ? ["login", "signup"]
      : [otpPurpose];

    let lastError: ApiRequestError | null = null;

    try {
      for (const purpose of purposes) {
        try {
          const data = await verifyOtp({
            phone_number: normalizedMobile,
            otp,
            purpose,
          });
          setVendorSession({
            mobile: normalizedMobile,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            user: data.user,
          });
          router.push("/dashboard");
          return;
        } catch (err) {
          if (err instanceof ApiRequestError) {
            lastError = err;
            if (err.code === "RATE_LIMITED" || err.status === 429) continue;
          }
        }
      }

      setError(
        lastError?.message ??
          "Unable to verify OTP. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("mobile");
    setOtp("");
    setOtpPurpose("login");
    setError("");
    setInfo("");
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-200/60">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
            <Building2 className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Link2Build
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isDevRentalVendor
              ? "Equipment Rental Vendor Portal"
              : isDevMaterialVendor
                ? "Material Supplier Portal"
                : "Vendor Portal"}
          </p>
        </div>

        {step === "mobile" ? (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <label
                htmlFor="mobile"
                className="mb-2 block text-xs font-medium tracking-wide text-gray-500 uppercase"
              >
                Mobile Number
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400"
                  strokeWidth={1.5}
                />
                <input
                  id="mobile"
                  type="tel"
                  placeholder={isDevRentalVendor ? "9811100001" : "9822200001"}
                  value={mobile}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setMobile(digits);
                    setError("");
                    setInfo("");
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pr-4 pl-10 text-sm text-gray-900 transition-all duration-200 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
              {isDevMaterialVendor ? (
                <p className="mt-2 text-xs text-amber-700">
                  Material vendor ({MATERIAL_VENDOR_PHONE_RANGE}) — after Send OTP use code{" "}
                  <span className="font-semibold">{MATERIAL_VENDOR_FIXED_OTP}</span>
                </p>
              ) : isDevRentalVendor ? (
                <p className="mt-2 text-xs text-amber-700">
                  Rental vendor ({RENTAL_VENDOR_PHONE_RANGE}) — after Send OTP use code{" "}
                  <span className="font-semibold">{RENTAL_VENDOR_FIXED_OTP}</span>
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={isLoading || !mobile}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-md shadow-amber-200/50 transition-all duration-200 hover:from-amber-600 hover:to-orange-600 focus:ring-2 focus:ring-amber-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <>
                  Send OTP
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in-up">
            <div className="text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                OTP sent to +91 {normalizedMobile}
              </div>
              <p className="text-xs text-gray-500">
                Enter the {otpLength}-digit code to continue
              </p>
              {devFixedOtp ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Dev OTP: {devFixedOtp}
                </p>
              ) : null}
            </div>

            <OtpInput
              length={otpLength}
              value={otp}
              onChange={setOtp}
              disabled={isLoading}
              variant="light"
              onEnter={() => {
                if (isValidOtp && !isLoading) void handleVerifyOtp();
              }}
            />

            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={isLoading || !isValidOtp}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200/50 transition-all duration-200 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <>
                  Verify & Login
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading}
              className="w-full text-center text-xs text-gray-500 transition-colors duration-200 hover:text-gray-800"
            >
              Change mobile number
            </button>
          </div>
        )}

        {info && (
          <p className="mt-4 text-center text-xs text-amber-700 animate-fade-in-up">
            {info}
          </p>
        )}

        {error && (
          <p className="mt-4 text-center text-xs text-red-600 animate-fade-in-up">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-[11px] text-gray-400">
          Secured access for authorized rental and material vendors
        </p>
      </div>
    </div>
  );
}
