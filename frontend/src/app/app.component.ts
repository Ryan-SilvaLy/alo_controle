import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from './services/authentication.service';
import { ViewChild, AfterViewInit } from '@angular/core';
import { SnackbarComponent } from './shared/snackbar/snackbar.component';
import { SnackbarService } from './shared/snackbar/snackbar.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent, NavbarComponent, CommonModule, SnackbarComponent], // Importar components `footer` e `navbar`.
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit{

  @ViewChild(SnackbarComponent) snackbarComponent!: SnackbarComponent;
  title = 'frontend';
  usuarioLogado: any;

  constructor (
    public router: Router,
    private authService: AuthenticationService,
    private snackbarService: SnackbarService
  ) {}


  ngOnInit() {
    this.authService.inicializarUsuarioLogado();
  }

  ngAfterViewInit(): void {
    this.snackbarService.register(this.snackbarComponent);
  }

  // Lista de rotas onde navbar e footer não devem aparecer
  hiddenRoutes = ['/login'];


  shouldShowLayout(): boolean {
    return !this.hiddenRoutes.includes(this.router.url);
  }

}
