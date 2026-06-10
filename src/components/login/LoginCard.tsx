"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Phone, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { OtpInput } from "./OtpInput";
import { consumeSessionExpiredMessage, setVendorSession } from "@/lib/auth";
import { ApiRequestError, sendOtp, verifyOtp } from "@/lib/api";
import { fetchVendorMe } from "@/lib/vendor";

const OTP_LENGTH = 4;

type LoginStep = "mobile" | "otp";

export function LoginCard() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"login" | "signup">("login");

  const isValidMobile = /^\d{10}$/.test(mobile.replace(/\s/g, ""));
  const isValidOtp = otp.length === OTP_LENGTH;

  useEffect(() => {
    const expiredMessage = consumeSessionExpiredMessage();
    if (expiredMessage) {
      setError(expiredMessage);
    }
  }, []);

  const handleSendOtp = async () => {
    if (!isValidMobile) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await sendOtp({
        phone_number: mobile,
        purpose: "login",
      });
      setOtpPurpose("login");
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        try {
          await sendOtp({
            phone_number: mobile,
            purpose: "signup",
          });
          setOtpPurpose("signup");
          setStep("otp");
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
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Unable to send OTP. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!isValidOtp) {
      setError(`Please enter the complete ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const data = await verifyOtp({
        phone_number: mobile,
        otp,
        purpose: otpPurpose,
      });
      setVendorSession({
        mobile,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
      });
      await fetchVendorMe().catch(() => null);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Unable to verify OTP. Please check your connection and try again."
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
          <p className="mt-1 text-sm text-gray-500">Vendor Portal</p>
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
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setMobile(digits);
                    setError("");
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pr-4 pl-10 text-sm text-gray-900 transition-all duration-200 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
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
                OTP sent to +91 {mobile}
              </div>
              <p className="text-xs text-gray-500">
                Enter the {OTP_LENGTH}-digit code to continue
              </p>
            </div>

            <OtpInput
              length={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              disabled={isLoading}
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

        {error && (
          <p className="mt-4 text-center text-xs text-red-600 animate-fade-in-up">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-[11px] text-gray-400">
          Secured access for authorized equipment vendors only
        </p>
      </div>
    </div>
  );
}
