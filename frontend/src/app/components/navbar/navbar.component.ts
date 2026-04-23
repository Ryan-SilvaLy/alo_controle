import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isSettingsOpen = false;
  infoUsuario: any;

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.authService.getUsuarioLogadoSubject().subscribe(usuario => {
      if (usuario) {
        this.infoUsuario = usuario;
      } else {
        this.snackbar.show('Usuário não encontrado', 'error');
      }
    });
  }

  toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  logout(): void {
    this.closeSettings();
    this.authService.logout();
    this.router.navigate(['/login']);
  }


  closeSettings(): void {
    this.isSettingsOpen = false;
  }


  onLinkClick(): void {
    this.closeSettings();
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.settings-wrapper')) {
      this.closeSettings();
    }
  }
}
