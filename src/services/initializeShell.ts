import { initializeAppearance } from '@/services/appearance';
import { initializeShell } from '@/services/nasShell';

initializeAppearance();
const disposeShell = initializeShell();

if (import.meta.hot) {
  import.meta.hot.dispose(disposeShell);
}
