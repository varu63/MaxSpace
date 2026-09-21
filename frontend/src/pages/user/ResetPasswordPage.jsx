import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { resetPassword } from "../../services/api";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  const validate = () => {
    const nextErrors = {};
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!token) {
      setFormError("This reset link is invalid. Please request a new one.");
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (error) {
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
            Reset your password
          </h1>

          <p className="text-sm text-[#747B83] mt-1">
            Choose a new password for your MaxSpace account
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          {done ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1B5E3C] mb-4">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h2 className="font-bold text-lg">Password updated</h2>
              <p className="text-sm text-[#747B83] mt-2">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
              <button
                onClick={() => navigate("/signin")}
                className="mt-6 w-full py-3 rounded-xl bg-[#173B5C] text-white font-bold hover:bg-[#122C47] transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {!token && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  This reset link is missing its token. Please request a new
                  password reset link.
                </div>
              )}

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {/* New password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-[#16263A] mb-1.5"
                >
                  New Password
                </label>

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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-[#A9A795]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-[#8A9096]"
                    aria-label="Toggle password visibility"
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

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-bold text-[#16263A] mb-1.5"
                >
                  Confirm New Password
                </label>

                <div
                  className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border transition-colors ${
                    errors.confirmPassword
                      ? "border-red-400"
                      : "border-[#E7E1D3] focus-within:border-[#173B5C]"
                  }`}
                >
                  <Lock className="w-4 h-4 text-[#8A9096] shrink-0" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-[#A9A795]"
                  />
                </div>

                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !token}
                className="w-full py-3 rounded-xl bg-[#173B5C] text-white font-bold hover:bg-[#122C47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Updating…" : "Reset Password"}
              </button>

              <p className="text-center text-xs text-[#747B83]">
                Remembered your password?{" "}
                <Link
                  to="/signin"
                  className="text-[#173B5C] font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;