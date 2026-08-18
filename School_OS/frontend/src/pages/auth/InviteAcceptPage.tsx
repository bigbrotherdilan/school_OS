import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useToastStore } from '../../stores/toastStore';
import { api } from '../../services/api';
import { KeyRound, ArrowLeft, CheckCircle, Eye, EyeOff, ShieldCheck, GraduationCap, Users, Banknote, Loader2 } from 'lucide-react';

const ROLE_ICONS: Record<string, any> = {
  admin: ShieldCheck, super_admin: ShieldCheck,
  teacher: GraduationCap, parent: Users, bursar: Banknote,
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const { data } = await api.get(`/auth/invite/${token}/`);
        setInvite(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Invalid or expired invitation link.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    if (formData.password.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/auth/invite/${token}/redeem/`, { password: formData.password });
      setSuccess(true);
      addToast('Account created successfully!', 'success');
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to accept invitation.';
      setError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
        <p className="mt-4 text-sm text-slate-500">Loading invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Invitation Invalid</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <Link to="/login" className="inline-block w-full py-3 px-4 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all text-center">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Welcome to {invite?.school_name}!</h2>
            <p className="text-sm text-slate-500">
              Your account has been created. You can now log in with your email and the password you just set.
            </p>
            <Link
              to={`/login/${invite?.role === 'teacher' ? 'teacher' : invite?.role === 'parent' ? 'parent' : invite?.role === 'bursar' ? 'bursar' : 'admin'}`}
              className="inline-block w-full py-3 px-4 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all text-center"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const RoleIcon = ROLE_ICONS[invite?.role] || ShieldCheck;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-bl-full blur-3xl -z-10"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
          <RoleIcon className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Join {invite?.school_name}</h2>
        <p className="mt-2 text-sm text-slate-500">
          You've been invited as a <span className="font-bold text-primary">{invite?.role_display}</span>
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>

          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Creating account for</p>
            <p className="text-sm font-bold text-slate-800">{invite?.first_name} {invite?.last_name}</p>
            <p className="text-xs text-slate-500">{invite?.email}</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Choose Password</label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-3 pr-10 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors sm:text-sm"
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
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="block w-full pl-3 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors sm:text-sm"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.password || !formData.confirm_password}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all"
            >
              {isSubmitting ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Create My Account'}
            </button>
          </form>
        </div>
        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}