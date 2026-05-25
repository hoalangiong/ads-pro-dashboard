import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(localStorage.getItem('selected_account') || '');
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(() => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) { setLoading(false); return; }
    setLoading(true);
    api.accounts()
      .then(data => {
        setAccounts(data);
        if (!selectedId && data[0]) {
          setSelectedId(data[0].id);
          localStorage.setItem('selected_account', data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => { loadAccounts(); }, []);

  const select = (id) => {
    setSelectedId(id);
    localStorage.setItem('selected_account', id);
  };

  const selected = accounts.find(a => a.id === selectedId) || accounts[0] || null;

  return (
    <AccountContext.Provider value={{ accounts, selected, selectedId: selected?.id || '', select, loading, refresh: loadAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
