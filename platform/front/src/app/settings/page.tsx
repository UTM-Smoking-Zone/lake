'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PortfolioBalance from '@/components/PortfolioBalance';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-sm text-gray-400">Manage your account and preferences</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Account Balance</p>
              <PortfolioBalance />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Section */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user.firstName || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user.lastName || ''}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user.email}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Trading Preferences */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Trading Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Email Notifications</label>
                    <p className="text-sm text-gray-400">Receive trade alerts via email</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Push Notifications</label>
                    <p className="text-sm text-gray-400">Browser push notifications for price alerts</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 text-blue-600" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Auto-Trading</label>
                    <p className="text-sm text-gray-400">Enable automated trading strategies</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Security</h3>
              <div className="space-y-4">
                <button className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Change Password
                </button>
                <button className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ml-0 md:ml-3">
                  Enable 2FA
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}