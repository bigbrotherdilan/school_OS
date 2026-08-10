import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer id="contact" className="bg-slate-50 w-full py-12 px-6 border-t border-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="bg-primary text-secondary-fixed p-1.5 rounded-lg">
                <span className="material-symbols-outlined text-lg leading-none">account_balance</span>
              </div>
              <div className="text-lg font-black text-primary tracking-tighter">
                School<span className="text-secondary">OS</span>
              </div>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              The modern operating system for schools. Streamline administration, finance, and learning in one platform.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link to="/features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/schools" className="hover:text-primary transition-colors">Find Schools</Link></li>
              <li><Link to="/find-teachers" className="hover:text-primary transition-colors">Teacher Marketplace</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-4">Get Started</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link to="/login" className="hover:text-primary transition-colors">School Login</Link></li>
              <li><Link to="/login/parent" className="hover:text-primary transition-colors">Parent Login</Link></li>
              <li><Link to="/login/teacher" className="hover:text-primary transition-colors">Teacher Login</Link></li>
              <li><Link to="/templates/school" className="hover:text-primary transition-colors">School Template</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} School OS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
