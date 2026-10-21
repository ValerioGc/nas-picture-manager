import { config } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach } from 'vitest';

beforeEach(() => {
  const pinia = createPinia();

  setActivePinia(pinia);
  config.global.plugins = [pinia];
});

HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
  this.querySelector<HTMLElement>('[autofocus]')?.focus();
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
