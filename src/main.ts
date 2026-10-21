import { guardFrame } from '@valeriogc/nas-base-app';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

import '@/services/initializeShell';
import '@valeriogc/nas-base-app/styles/_nas-theme.scss';
import '@valeriogc/nas-base-app/styles/_nas-apps.scss';
import '@valeriogc/nas-base-app/styles/_nas-scrollbar.scss';

import '@/styles/theme.scss';
import '@/styles/main.scss';

guardFrame();

createApp(App).use(createPinia()).mount('#app');
