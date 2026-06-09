import { Component } from '@angular/core';
import { ManagerService } from './services/manager.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'qute-frontend';
  public static error = '';
  public static quirkUrl = 'https://quirk.quantum';

  constructor(public manager: ManagerService) {}
}
