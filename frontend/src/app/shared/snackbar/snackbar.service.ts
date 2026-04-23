import { Injectable } from '@angular/core';
import { SnackbarComponent } from './snackbar.component';


@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  constructor() { }

  private snackbarComponent!: SnackbarComponent;

  register(snackbar: SnackbarComponent) {
    this.snackbarComponent = snackbar;
  }

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) {
    if (this.snackbarComponent) {
      this.snackbarComponent.show(message, type, duration);
    }
  }
}
