import React from 'react';
import ProfileEditor from '../../components/ui/ProfileEditor';
import ChangePasswordCard from '../../components/ui/ChangePasswordCard';

const ParentSettings: React.FC = () => {
    return (
        <div className="flex flex-col gap-5 pb-6">
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your account preferences</p>
            </header>

            <ProfileEditor role="parent" />
            <ChangePasswordCard />
        </div>
    );
};

export default ParentSettings;
