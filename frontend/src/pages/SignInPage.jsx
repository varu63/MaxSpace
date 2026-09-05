import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  BatteryCharging,
} from "lucide-react";

import { useBattery } from "../context/BatteryContext";

const SignInPage = () => {
  const { signIn } = useBattery();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validate()) return;

    setSubmitting(true);

    setTimeout(() => {
      signIn({ email: email.trim() });
      navigate("/home");
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F2DE] text-[#16263A] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-[#E9E4D7] shadow-sm overflow-hidden mb-4">
            <img
              src="/Logo.jpeg"
              alt=""
              className="w-full h-full object-scale-down"
            />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#16263A]">
            Welcome back
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Sign in to access your Digital Product Passports
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8">
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
                className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-slate-100 border transition-colors ${
                  errors.email
                    ? "border-red-400"
                    : "border-transparent focus-within:border-yellow-400"
                }`}
              >
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
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
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-slate-400 focus:outline-none"
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
                  className="text-xs text-yellow-700 hover:text-yellow-900 font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              <div
                className={`flex items-center gap-2.5 px-3.5 rounded-xl bg-slate-100 border transition-colors ${
                  errors.password
                    ? "border-red-400"
                    : "border-transparent focus-within:border-yellow-400"
                }`}
              >
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
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
                  className="w-full py-3 bg-transparent text-sm text-[#16263A] placeholder:text-slate-400 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase">
              or
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Sign up link */}
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-bold text-yellow-700 hover:text-yellow-900"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-700" />
            EU DPP 2023/1542
          </span>

          <span className="flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-yellow-700" />
            ISO 26262 ASIL-D
          </span>

          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-700" />
            Real-time Telemetry
          </span>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
