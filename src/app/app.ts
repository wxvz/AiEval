import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from './components/navbar/navbar';
import { SettingsAside } from './components/settings-aside/settings-aside';
import { StatusAlert } from './components/status-alert/status-alert';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, SettingsAside, StatusAlert],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
