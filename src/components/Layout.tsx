import React from 'react';
import { Navbar } from './Navbar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Navbar />
      <main className="flex-grow flex flex-col">
        {children}
      </main>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-6 text-center transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-gray-400 dark:text-gray-500 text-xs font-bold tracking-widest uppercase">
          &copy; {new Date().getFullYear()} CHERCHER Result Management System. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
};
