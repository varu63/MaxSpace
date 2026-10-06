import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  MailCheck,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  BatteryCharging,
  X,
} from "lucide-react";

import { useBattery } from "../../context/BatteryContext";
import { forgotPassword, resendVerificationEmail } from "../../services/api";
import GoogleSignInButton from "../../components/common/GoogleSignInButton";

const SignInPage = () => {
  const { signIn, signInWithGoogle, addToast } = useBattery();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  /* Unverified account: the backend answers 403 EMAIL_NOT_VERIFIED and we
     offer a resend right here instead of failing the sign-in silently. */
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifySent, setVerifySent] = useState("");

  const validate = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) return;

    setSubmitting(true);

    try {
      // Authenticate with the backend; navigate only on success
      await signIn({ email: email.trim(), password });
      navigate("/home");
    } catch (error) {
      if (error?.code === "EMAIL_NOT_VERIFIED") {
        // Correct credentials, unverified address: offer the resend here
        // rather than a dead-end error toast.
        setVerifyEmail(email.trim());
        setVerifyError("");
        setVerifySent("");
        setIsVerifyOpen(true);
      } else {
        addToast("Sign In Failed", error?.message || "Invalid email or password.", "error");
      }
      setSubmitting(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(email.trim() || "");
    setForgotError("");
    setForgotSent(false);
    setIsForgotOpen(true);
  };

  const handleGoogleCredential = async (credential) => {
    if (!credential) return; // user closed the Google dialog without completing
    setSubmitting(true);
    try {
      const data = await signInWithGoogle(credential);
      if (data?.isNewUser) {
        addToast(
          "Welcome to MaxSpace",
          "No account existed for this Google email, so we created one for you.",
          "info",
        );
      }
      navigate("/home");
    } catch (error) {
      addToast(
        "Google Sign-In Failed",
        error?.message || "Could not sign in with Google.",
        "error",
      );
      setSubmitting(false);
    }
  };

  const closeForgot = () => {
    setIsForgotOpen(false);
    setForgotEmail("");
    setForgotError("");
    setForgotSent(false);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();

    const email = forgotEmail.trim();
    if (!email) {
      setForgotError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotSubmitting(true);
    try {
      await forgotPassword(email);
      setForgotSent(true);
    } catch (error) {
      setForgotError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const closeVerify = () => {
    setIsVerifyOpen(false);
    setVerifyError("");
    setVerifySent("");
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();

    const value = verifyEmail.trim();
    if (!value) {
      setVerifyError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setVerifyError("Please enter a valid email address.");
      return;
    }

    setVerifySubmitting(true);
    setVerifyError("");
    try {
      const data = await resendVerificationEmail(value);
      setVerifySent(
        data?.message ||
          "If an unverified account exists for this email, a new verification link has been sent.",
      );
    } catch (error) {
      setVerifyError(
        error?.status === 429
          ? "Too many email requests. Please wait a few minutes and try again."
          : error?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setVerifySubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F2DE] text-[#16263A] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white dark:bg-white border border-[#EEE9DA] shadow-sm overflow-hidden mb-4">
            <img
              src="/Logo.png"
              alt=""
              className="w-full h-full object-scale-down"
            />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#16263A]">
            Welcome back
          </h1>

          <p className="text-sm text-[#747B83] mt-1">
            Sign in to access your Digital Product Passports
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          {/* Continue with Google */}
          <div>
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              disabled={submitting}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#E7E1D3]" />
            <span className="text-[11px] font-semibold text-[#8A9096] uppercase">
              or
            </span>
            <div className="flex-1 h-px bg-[#E7E1D3]" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-[#16263A] mb-1.5"
              >
                Email
              </label>

              <div
                className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border transition-colors ${
                  errors.email
                    ? "border-red-400"
                    : "border-[#E7E1D3] focus-within:border-[#173B5C]"
                }`}
              >
                <Mail className="w-4 h-4 text-[#8A9096] shrink-0" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) {
                      setErrors((previous) => ({
                        ...previous,
                        email: undefined,
                      }));
                    }
                  }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                />
              </div>

              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-[#16263A]"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs text-[#B48611] hover:text-[#8A7A4A] font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              <div
                className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border transition-colors ${
                  errors.password
                    ? "border-red-400"
                    : "border-[#E7E1D3] focus-within:border-[#173B5C]"
                }`}
              >
                <Lock className="w-4 h-4 text-[#8A9096] shrink-0" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) {
                      setErrors((previous) => ({
                        ...previous,
                        password: undefined,
                      }));
                    }
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="text-[#8A9096] hover:text-[#16263A] transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="
                w-full flex items-center justify-center gap-2
                py-3.5 rounded-xl
                bg-[#173B5C] text-white font-bold text-sm
                hover:bg-[#102F4A]
                active:scale-[0.99]
                transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="text-center mt-6">
            <p className="text-sm text-[#747B83]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-bold text-[#B48611] hover:text-[#8A7A4A]"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-[#747B83]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B48611]" />
            EU DPP 2023/1542
          </span>

          <span className="flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-[#B48611]" />
            ISO 26262 ASIL-D
          </span>

          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#B48611]" />
            Real-time Telemetry
          </span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm" onClick={closeForgot} />
          <div className="relative w-full max-w-sm bg-[#FFFDF8] rounded-2xl shadow-xl border border-[#EEE9DA] p-6">
            <button
              type="button"
              onClick={closeForgot}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#F5F1E7] flex items-center justify-center hover:bg-[#E7E1D3] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F5F1E7] mb-3">
                <Mail className="w-5 h-5 text-[#B48611]" />
              </div>
              <h3 className="text-lg font-bold text-[#16263A]">Reset Password</h3>
              <p className="text-sm text-[#747B83] mt-1">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            {forgotSent ? (
              <div className="text-center">
                <p className="text-sm text-[#16263A] mb-4">
                  A password reset link has been sent to{" "}
                  <strong>{forgotEmail}</strong>. Check your inbox (and spam
                  folder) and click the link to choose a new password.
                </p>
                <button
                  type="button"
                  onClick={closeForgot}
                  className="w-full py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-bold text-[#16263A] mb-1.5">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] focus-within:border-[#173B5C] transition-colors">
                    <Mail className="w-4 h-4 text-[#8A9096] shrink-0" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotError) setForgotError("");
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                    />
                  </div>
                  {forgotError && (
                    <p className="mt-1 text-xs text-red-600">{forgotError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {forgotSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unverified-account modal (403 EMAIL_NOT_VERIFIED) */}
      {isVerifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
            onClick={closeVerify}
          />
          <div className="relative w-full max-w-sm bg-[#FFFDF8] rounded-2xl shadow-xl border border-[#EEE9DA] p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={closeVerify}
              className="absolute right-4 top-4 text-[#8A9096] hover:text-[#16263A]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F5F1E7] text-[#B48611] mb-3">
                <MailCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#16263A]">
                Verify your email
              </h3>
              <p className="text-sm text-[#747B83] mt-1">
                Your account hasn't been verified yet. Enter your address below
                and we'll send you a fresh verification link.
              </p>
            </div>

            {verifySent ? (
              <div className="space-y-4">
                <p className="text-xs text-[#1B5E3C] bg-[#EAF4EE] border border-[#CFE6D9] rounded-xl p-3">
                  {verifySent}
                </p>
                <button
                  type="button"
                  onClick={closeVerify}
                  className="w-full py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifySubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="verify-email-input"
                    className="block text-xs font-bold text-[#16263A] mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] focus-within:border-[#173B5C] transition-colors">
                    <Mail className="w-4 h-4 text-[#8A9096] shrink-0" />
                    <input
                      id="verify-email-input"
                      type="email"
                      value={verifyEmail}
                      onChange={(e) => {
                        setVerifyEmail(e.target.value);
                        if (verifyError) setVerifyError("");
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full py-2.5 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                    />
                  </div>
                  {verifyError && (
                    <p className="mt-1 text-xs text-red-600">{verifyError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={verifySubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#173B5C] text-white font-bold text-sm hover:bg-[#102F4A] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifySubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    "Send Verification Link"
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeVerify}
                  className="w-full py-2.5 rounded-xl text-[#173B5C] font-bold text-sm hover:bg-[#F5F1E7] transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignInPage;
