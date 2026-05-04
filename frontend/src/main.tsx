import { createRoot } from 'react-dom/client';
import './index.css';
import './components/velxio-components/IC74HC595';
import './components/velxio-components/LogicGateElements';
import './components/velxio-components/TransistorElements';
import './components/velxio-components/OpAmpElements';
import './components/velxio-components/PowerElements';
import './components/velxio-components/DiodeElements';
import './components/velxio-components/RelayElements';
import './components/velxio-components/LogicICElements';
import './components/velxio-components/FlipFlopElements';
import './components/velxio-components/RaspberryPi3Element';
import './components/velxio-components/Bmp280Element';
import './components/velxio-components/EPaperElement';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

// Optional pro overlay. The `@pro` import resolves to a no-op stub in the
// open-source build (see vite.config.ts) and to the real overlay only when
// VITE_PRO_BUILD=true at build time. The dynamic import keeps the pro chunk
// out of the OSS bundle entirely (Vite tree-shakes the never-taken branch).
if (import.meta.env.VITE_PRO_BUILD) {
  import('@pro/index')
    .then((m) => m.mountPro?.())
    .catch((err) => console.warn('[pro] failed to load overlay:', err));
}
