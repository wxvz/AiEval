declare var bootstrap: {
  Modal: typeof import('bootstrap/js/dist/modal').default;
  Offcanvas: typeof import('bootstrap/js/dist/offcanvas').default;
};

declare module 'bootstrap/js/src/collapse.js' {
  const Collapse: typeof import('bootstrap/js/dist/collapse').default;
  export default Collapse;
}

declare module 'bootstrap/js/src/modal.js' {
  const Modal: typeof import('bootstrap/js/dist/modal').default;
  export default Modal;
}

declare module 'bootstrap/js/src/offcanvas.js' {
  const Offcanvas: typeof import('bootstrap/js/dist/offcanvas').default;
  export default Offcanvas;
}
