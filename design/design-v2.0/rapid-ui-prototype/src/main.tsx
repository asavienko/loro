import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installAudioUnlock } from './audio/unlock';
import { openStorage, Stored } from './state/storage';
import './index.css';

installAudioUnlock();

// Progress is read before the first render, so the app never flashes an empty state.
const start = (stored: Stored) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App stored={stored} />
    </StrictMode>,
  );
openStorage().then(start, () => start({ saved: null, pending: null }));
