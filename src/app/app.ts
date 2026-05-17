import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from './components/navbar/navbar';
import { StatusAlert } from './components/status-alert/status-alert';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, StatusAlert],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
