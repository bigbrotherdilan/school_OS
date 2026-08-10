import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export default function PasswordInput({ value, onChange, placeholder = '••••••••', className = '' }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className="material-symbols-outlined text-slate-400 text-[20px]">lock</span>
      </div>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className={`block w-full pl-10 pr-11 py-3 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-colors sm:text-sm ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">{show ? 'visibility_off' : 'visibility'}</span>
      </button>
    </>
  );
}
