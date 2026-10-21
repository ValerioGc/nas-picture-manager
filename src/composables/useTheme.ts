import { onMounted, ref, watch } from 'vue';

type AppTheme = 'light' | 'dark';

const theme = ref<AppTheme>('dark');

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = theme.value;
  root.style.colorScheme = root.dataset.nasShell === 'true' ? 'normal' : theme.value;
}

export function setTheme(nextTheme: AppTheme) {
  theme.value = nextTheme;
  applyTheme();
}

export function useTheme() {
  onMounted(applyTheme);
  watch(theme, applyTheme);

  return { theme, setTheme };
}
