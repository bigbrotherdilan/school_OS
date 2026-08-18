import { useState } from 'react';
import { Copy, Check, KeyRound, AlertTriangle, MessageCircle, Link2 } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

interface CredentialsCardProps {
  email: string;
  password: string;
  label?: string;
  note?: string;
  loginPortal?: 'admin' | 'teacher' | 'parent' | 'bursar';
}

export default function CredentialsCard({ email, password, label = 'Temporary Password', note, loginPortal }: CredentialsCardProps) {
  const { addToast } = useToastStore();
  const [copied, setCopied] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const baseUrl = window.location.origin;
  const loginUrl = loginPortal ? `${baseUrl}/login/${loginPortal}` : `${baseUrl}/login`;

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const copyAllCredentials = async () => {
    const text = `School OS Login Credentials\n\nEmail: ${email}\nPassword: ${password}\nLogin: ${loginUrl}\n\nNote: You must change your password after first login.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setCopiedAll(false);
    }
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `School OS Login Credentials\n\nEmail: ${email}\nPassword: ${password}\nLogin: ${loginUrl}\n\nNote: You must change your password after first login.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(loginUrl);
      addToast('Login link copied to clipboard.', 'success');
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-700/70">{label}</p>
          <p className="text-sm font-black text-on-surface">{email}</p>
        </div>
      </div>

      <div className="bg-white border border-amber-200/70 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <code className="text-lg font-mono font-black tracking-wider text-amber-900 break-all">{password}</code>
        <button
          type="button"
          onClick={copyPassword}
          className="shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={copyAllCredentials}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200/70 rounded-xl text-xs font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100 active:scale-95 transition-all"
        >
          {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedAll ? 'Copied!' : 'Copy Credentials'}
        </button>
        <button
          type="button"
          onClick={shareViaWhatsApp}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#128C7E] active:scale-95 transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={copyLoginLink}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200/70 rounded-xl text-xs font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100 active:scale-95 transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          Copy Login Link
        </button>
      </div>

      <p className="flex items-start gap-2 text-xs text-amber-800/80 font-medium leading-relaxed">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {note || 'This password is shown only once. Share it with the account holder in person, by phone, or via WhatsApp. They must change it after their first login.'}
        </span>
      </p>
    </div>
  );
}