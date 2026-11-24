import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/noto-naskh-arabic';
import '@fontsource-variable/noto-sans-arabic';
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/noto-kufi-arabic';
import './index.css';
import { setUpApp } from './lib/pwa';
import { startTranslator } from './i18n/translator';
import { loadAppearance } from './lib/appearance';

setUpApp();
loadAppearance();

// The interface language is ready before the first page is drawn, so Kurdish
// and Arabic readers do not see English text flash first.
startTranslator()
  .catch((e) => console.warn('Translation could not start', e))
  .finally(() => createRoot(document.getElementById('root')!).render(<App />));
