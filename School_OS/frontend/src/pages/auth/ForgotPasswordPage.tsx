import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToastStore } from '../../stores/toastStore';
import { api } from '../../services/api';
import { Mail, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/auth/password-reset-request/', { email });
      setSent(true);
    } catch {
      addToast('Failed to send reset email. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Check Your Email</h2>
            <p className="text-sm text-slate-500">
              If an account exists with <span className="font-bold text-slate-700">{email}</span>, we've sent a password reset link.
            </p>
            <p className="text-xs text-slate-400">
              Didn't receive it? Check your spam folder or try again.
            </p>
            <div className="pt-4 space-y-3">
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                Try Another Email
              </button>
              <Link to="/login" className="block text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-slate-300/30 rounded-bl-full blur-3xl -z-10"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <KeyRound className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reset Password</h2>
        <p className="mt-2 text-sm text-slate-500">Enter your email to receive a reset link</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800"></div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="text-slate-400 w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-colors sm:text-sm"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Send Reset Link'}
            </button>
          </form>
        </div>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}