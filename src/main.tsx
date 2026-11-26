import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './App';
import { loadState } from './data/store';
import { applyTheme } from './theme';

loadState().then((s) => {
  applyTheme(s.settings);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
