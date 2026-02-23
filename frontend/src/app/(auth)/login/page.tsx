import { Mail } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Sign in</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Enter your email to access the platform.
        </p>
      </div>

      {/* Email input */}
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-[13px] font-medium text-gray-700"
        >
          Email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-all duration-150 focus:border-ocean-600 focus:ring-2 focus:ring-ocean-600/20"
          />
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        className="flex h-10 w-full items-center justify-center rounded-md bg-ocean-600 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700 disabled:opacity-50"
      >
        Continue with email
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-500">or</span>
        </div>
      </div>

      {/* Social login buttons placeholder */}
      <div className="space-y-3">
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-x-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
        >
          Continue with Google
        </button>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-x-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
        >
          Continue with Apple
        </button>
      </div>

      {/* Legal text */}
      <p className="text-center text-xs text-gray-400">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
