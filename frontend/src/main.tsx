import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AppDataProvider } from '@/data/AppDataProvider';
import { NoiseOverlay } from '@/components/layout/NoiseOverlay';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado no index.html.');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AppDataProvider>
        <NoiseOverlay />
        <App />
        <Toaster
          position="top-center"
          expand={false}
          closeButton
          duration={4200}
          toastOptions={{
            classNames: {
              toast:
                'glass !rounded-2xl !border-gold-500/25 !bg-onyx-900/90 !text-ivory !shadow-glass-lg',
              title: '!font-medium !text-ivory',
              description: '!text-muted',
              actionButton: '!bg-brand-gradient !text-onyx-950 !font-semibold',
              cancelButton: '!bg-onyx-800 !text-muted',
              closeButton: '!bg-onyx-800 !border-gold-500/25 !text-muted',
              success: '!border-status-approved/40',
              error: '!border-status-rejected/40',
            },
          }}
        />
      </AppDataProvider>
    </BrowserRouter>
  </StrictMode>
);
