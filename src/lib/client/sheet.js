import { writable } from 'svelte/store';

const initialState = {
  open: false,
  title: '',
  component: null,
  props: {}
};

function createSheetStore() {
  const { subscribe, set } = writable(initialState);

  return {
    subscribe,
    open({ title = '', component = null, props = {} }) {
      set({
        open: true,
        title,
        component,
        props
      });
    },
    close() {
      set(initialState);
    }
  };
}

export const sheetState = createSheetStore();

export function openSheet(options) {
  sheetState.open(options);
}

export function closeSheet() {
  sheetState.close();
}
