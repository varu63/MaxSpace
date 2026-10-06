import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Mail,
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  Send,
  ArrowRight,
  PenLine,
} from "lucide-react";

import { resendVerificationEmail } from "../../services/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* One view per backend outcome. The backend validates the token and
   redirects here with ?status=… — this screen never decides anything
   about the token itself. */
const VIEWS = {
  sent: {
    Icon: Mail,
    accent: "bg-[#F5F1E7] text-[#B48611]",
    title: "Account created",
    body: "Please check your email to verify your account. We sent a verification link — click it to activate your account.",
    showResend: true,
    showSignIn: false,
  },
  verified: {
    Icon: ShieldCheck,
    accent: "bg-[#1B5E3C] text-white",
    title: "Email verified successfully",
    body: "Your MaxSpace account is now active. You can sign in with your email and password.",
    showResend: false,
    showSignIn: true,
  },
  "already-verified": {
    Icon: ShieldCheck,
    accent: "bg-[#1B5E3C] text-white",
    title: "Email already verified",
    body: "This address has already been confirmed, so there is nothing left to do. You can sign in to MaxSpace.",
    showResend: false,
    showSignIn: true,
  },
  expired: {
    Icon: Clock,
    accent: "bg-[#B48611] text-white",
    title: "Verification link expired",
    body: "This link is no longer valid. Verification links last 24 hours — request a new one below and we'll email you a fresh link.",
    showResend: true,
    showSignIn: false,
  },
  invalid: {
    Icon: XCircle,
    accent: "bg-red-600 text-white",
    title: "Verification link invalid",
    body: "This link is invalid or has already been used. Request a new verification email below and we'll send you a fresh link.",
    showResend: true,
    showSignIn: false,
  },
  default: {
    Icon: PenLine,
    accent: "bg-[#F5F1E7] text-[#B48611]",
    title: "Verify your email",
    body: "Enter the email address you signed up with and we'll send you a verification link.",
    showResend: true,
    showSignIn: false,
  },
};

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") || "";
  const emailParam = searchParams.get("email") || "";
  // signup passes sent=0 when the provider rejected the first attempt.
  const firstSendFailed = searchParams.get("sent") === "0";

  const view = VIEWS[status] || VIEWS.default;
  const { Icon, accent, title, body, showResend, showSignIn } = view;

  const [email, setEmail] = useState(emailParam);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");

  const handleResend = async (event) => {
    event.preventDefault();

    const value = email.trim();
    if (!value) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    setError("");
    setSentMessage("");
    try {
      const data = await resendVerificationEmail(value);
      setSentMessage(
        data?.message ||
          "If an unverified account exists for this email, a new verification link has been sent.",
      );
    } catch (err) {
      setError(
        err?.status === 429
          ? "Too many email requests. Please wait a few minutes and try again."
          : err?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F2DE] text-[#16263A] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-[#EEE9DA] shadow-sm overflow-hidden mb-4">
            <img src="/Logo.png" alt="" className="w-full h-full object-scale-down" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#16263A]">
            Verify your email
          </h1>
          <p className="text-sm text-[#747B83] mt-1">
            One step left to activate your MaxSpace account
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 text-center">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ${accent}`}
          >
            <Icon className="w-6 h-6" />
          </div>

          <h2 className="font-bold text-lg text-[#16263A]">{title}</h2>
          <p className="text-sm text-[#747B83] mt-2 leading-relaxed">{body}</p>

          {firstSendFailed && showResend && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 text-left">
              We could not send the verification email automatically. Use the
              form below to request it again.
            </div>
          )}

          {showResend && (
            <form onSubmit={handleResend} className="mt-6 text-left space-y-3">
              <div>
                <label
                  htmlFor="verify-email"
                  className="block text-xs font-bold text-[#16263A] mb-1.5"
                >
                  Email Address
                </label>
                <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] focus-within:border-[#173B5C] transition-colors">
                  <Mail className="w-4 h-4 text-[#8A9096] shrink-0" />
                  <input
                    id="verify-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                  />
                </div>
                {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Resend Verification Email
                  </>
                )}
              </button>

              {sentMessage && (
                <p className="text-xs text-[#1B5E3C] bg-[#EAF4EE] border border-[#CFE6D9] rounded-xl p-3">
                  {sentMessage}
                </p>
              )}
            </form>
          )}

          {(showSignIn || showResend) && (
            <div className="mt-6">
              <Link
                to="/signin"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#122C47] transition-colors"
              >
                Go to Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <p className="text-center text-xs text-[#747B83] mt-4">
            Wrong address?{" "}
            <Link
              to="/signup"
              className="text-[#173B5C] font-semibold hover:underline"
            >
              Create a different account
            </Link>
          </p>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-[#747B83]">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#B48611]" />
            Links expire after 24 hours
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B48611]" />
            Single-use verification tokens
          </span>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
