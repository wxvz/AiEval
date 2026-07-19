import { bootstrapApplication } from '@angular/platform-browser';
import 'bootstrap/js/src/collapse.js';
import Modal from 'bootstrap/js/src/modal.js';
import Offcanvas from 'bootstrap/js/src/offcanvas.js';

import { appConfig } from './app/app.config';
import { App } from './app/app';

globalThis.bootstrap = { Modal, Offcanvas };

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
