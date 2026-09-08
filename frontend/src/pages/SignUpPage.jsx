import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  BatteryCharging,
  Zap,
} from "lucide-react";

import { useBattery } from "../context/BatteryContext";

const SignUpPage = () => {
  const { signUp, addToast } = useBattery();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [agree, setAgree] = useState(false);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((previous) => ({
        ...previous,
        [field]: undefined,
      }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Full name is required.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!agree) {
      nextErrors.agree = "You must accept the terms to continue.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) return;

    setSubmitting(true);

    try {
      // Register with the backend; navigate only on success
      await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      navigate("/home");
    } catch (error) {
      addToast(
        "Sign Up Failed",
        error?.message || "Could not create account.",
        "error",
      );
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
              alt="MaxSpace"
              className="w-full h-full object-scale-down"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#16263A]">
            Create your MaxSpace account
          </h1>
          <p className="text-sm text-[#747B83] mt-1">
            Start managing your battery fleet &amp; passports
          </p>
        </div>
        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold text-[#16263A] mb-1.5"
              >
                Full Name
              </label>
              <div
                className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-[#F5F1E7] border transition-colors ${
                  errors.name
                    ? "border-red-400"
                    : "border-[#E7E1D3] focus-within:border-[#173B5C]"
                }`}
              >
                <User className="w-4 h-4 text-[#8A9096] shrink-0" />
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>
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
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="you@gmail.com"
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
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[#16263A] mb-1.5"
              >
                Password
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
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
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

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-bold text-[#16263A] mb-1.5"
              >
                Confirm Password
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
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateField("confirmPassword", event.target.value)
                  }
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-[#8A9096] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  className="text-[#8A9096] hover:text-[#16263A] transition-colors"
                  title={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => {
                    setAgree(event.target.checked);
                    if (errors.agree) {
                      setErrors((previous) => ({
                        ...previous,
                        agree: undefined,
                      }));
                    }
                  }}
                  className="mt-0.5 w-4 h-4 accent-[#173B5C]"
                />

                <span className="text-xs text-[#747B83] leading-relaxed">
                  I agree to the{" "}
                  <span className="text-[#B48611] font-semibold">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="text-[#B48611] font-semibold">
                    Privacy Policy
                  </span>
                </span>
              </label>

              {errors.agree && (
                <p className="mt-1 text-xs text-red-600">{errors.agree}</p>
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
                mt-2
              "
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E7E1D3]" />
            <span className="text-[11px] font-semibold text-[#8A9096] uppercase">
              or
            </span>
            <div className="flex-1 h-px bg-[#E7E1D3]" />
          </div>

          {/* Sign in link */}
          <div className="text-center">
            <p className="text-sm text-[#747B83]">
              Already have an account?{" "}
              <Link
                to="/signin"
                className="font-bold text-[#B48611] hover:text-[#8A7A4A]"
              >
                Sign in
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
    </div>
  );
};

export default SignUpPage;
