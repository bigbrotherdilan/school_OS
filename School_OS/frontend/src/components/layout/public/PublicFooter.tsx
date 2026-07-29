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
              <li><Link to="/#features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/trust" className="hover:text-primary transition-colors">Trust</Link></li>
              <li><Link to="/templates/school" className="hover:text-primary transition-colors">School Template</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Press</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
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
