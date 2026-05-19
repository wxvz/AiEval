declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (
      element: Element,
      options?: Record<string, unknown>,
    ) => {
      show: () => void;
      hide: () => void;
    };
  };
};
