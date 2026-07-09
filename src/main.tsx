import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';

// Global monkeypatch for fetch to broadcast successful ERP mutations to useAdaptivePolling
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.ok) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const options = args[1];
    const method = options?.method || 'GET';
    if (
      (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
      (url.includes('/api/') || url.includes('/procurement') || url.includes('/grns') || url.includes('/approvals') || url.includes('/vendor-invoices') || url.includes('/vendor-payments'))
    ) {
      window.dispatchEvent(new CustomEvent('erp_activity_performed'));
    }
  }
  return response;
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
