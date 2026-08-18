import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useToastStore } from '../../stores/toastStore';
import { api } from '../../services/api';
import { KeyRound, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    if (formData.new_password.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/password-reset-confirm/', {
        uid,
        token,
        new_password: formData.new_password,
      });
      setSuccess(true);
      addToast('Password reset successfully.', 'success');
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Invalid or expired reset link.';
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Password Reset Complete</h2>
            <p className="text-sm text-slate-500">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-3 px-4 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all text-center"
            >
              Go to Login
            </Link>
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
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Set New Password</h2>
        <p className="mt-2 text-sm text-slate-500">Choose a strong password for your account</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800"></div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  className="block w-full pl-3 pr-10 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-colors sm:text-sm"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                className="block w-full pl-3 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-colors sm:text-sm"
                placeholder="Re-enter new password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.new_password || !formData.confirm_password}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Reset Password'}
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