// jsdom gaps that the UI touches. Engine and store tests run in node and skip this.
if (typeof window !== 'undefined' && typeof (window as Partial<Window>).matchMedia !== 'function') {
  const matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, writable: true });
}
