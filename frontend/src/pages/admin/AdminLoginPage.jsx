import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

import { useAdmin } from "../../context/AdminContext";
import { getErrorMessage } from "../../services/adminApi";

const AdminLoginPage = () => {
  const { adminLogin } = useAdmin();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
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
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!validate()) return;

    setSubmitting(true);

    try {
      await adminLogin({ email: email.trim(), password });
      navigate("/admin", { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
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

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF1C9] border border-[#F0E6C8] mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B48611]" />
            <span className="text-[11px] font-bold text-[#A77A08] uppercase tracking-wide">
              Admin Access
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#16263A]">
            Admin Sign In
          </h1>

          <p className="text-sm text-[#747B83] mt-1">
            Manage service requests, technicians & customers
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          {formError && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-expand">
              <span className="mt-0.5">⚠</span>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="admin-email"
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
                  id="admin-email"
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
                    if (formError) setFormError("");
                  }}
                  placeholder="admin@maxspace.com"
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
                htmlFor="admin-password"
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
                  id="admin-password"
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
                    if (formError) setFormError("");
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
                  Verifying…
                </>
              ) : (
                <>
                  Sign In to Admin Panel
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E7E1D3]" />
            <KeyRound className="w-4 h-4 text-[#B48611]" />
            <div className="flex-1 h-px bg-[#E7E1D3]" />
          </div>

          {/* Back link */}
          <div className="text-center">
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#747B83] hover:text-[#16263A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to customer app
            </Link>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-[#747B83]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B48611]" />
            Role-based access
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#B48611]" />
            Server-verified
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;