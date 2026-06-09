import React, { createContext, useContext, useState, useEffect } from 'react';

export type Page = 'portal' | 'developer' | 'verify' | 'documentation';

interface NavigationContextType {
  currentPage: Page;
  navigateTo: (page: Page) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    try {
      const saved = localStorage.getItem('last_visited_page') as Page;
      if (saved && saved !== 'developer') {
        return saved;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'portal';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#developer') {
        setCurrentPage('developer');
      } else if (window.location.hash === '#verify') {
        setCurrentPage('verify');
      } else if (window.location.hash === '#documentation') {
        setCurrentPage('documentation');
      } else {
        try {
          const saved = localStorage.getItem('last_visited_page') as Page;
          if (saved && saved !== 'developer') {
            setCurrentPage(saved);
          } else {
            setCurrentPage('portal');
          }
        } catch {
          setCurrentPage('portal');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: Page) => {
    if (page === 'developer') {
      window.location.hash = '#developer';
    } else if (page === 'verify') {
      window.location.hash = '#verify';
    } else if (page === 'documentation') {
      window.location.hash = '#documentation';
    } else {
      window.location.hash = '';
    }
    
    if (page !== 'developer') {
      try {
        localStorage.setItem('last_visited_page', page);
      } catch (err) {
        console.warn(err);
      }
    }
    setCurrentPage(page);
  };

  return (
    <NavigationContext.Provider value={{ currentPage, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
