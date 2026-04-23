import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';


@Component({
  selector: 'app-snackbar',
  imports: [CommonModule],
  templateUrl: './snackbar.component.html',
  styleUrl: './snackbar.component.scss'
})
export class SnackbarComponent {

  message = '';
  type: 'success' | 'error' | 'warning' | 'info' = 'info';
  visible = false;
  timeoutRef: any;

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) {
    this.message = message;
    this.type = type;
    this.visible = true;

    clearTimeout(this.timeoutRef);
    this.timeoutRef = setTimeout(() => {
      this.visible = false;
    }, duration);

}

}