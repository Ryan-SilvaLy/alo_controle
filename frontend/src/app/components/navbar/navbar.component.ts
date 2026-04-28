import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { AssinaturaEpiService } from '../../services/assinatura-epi.service';
import { AuthenticationService } from '../../services/authentication.service';
import { PedidoService } from '../../services/pedido.service';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isSettingsOpen = false;
  infoUsuario: any;
  totalPedidosNotificacao = 0;
  totalAssinaturasEpiAbertas = 0;
  private subscriptions = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private snackbar: SnackbarService,
    private pedidoService: PedidoService,
    private assinaturaEpiService: AssinaturaEpiService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.authService.getUsuarioLogadoSubject().subscribe(usuario => {
      if (usuario) {
        this.infoUsuario = usuario;
        this.atualizarContadorPedidos();
        this.atualizarContadorAssinaturasEpi();
      } else {
        this.snackbar.show('Usuario nao encontrado', 'error');
      }
    }));

    this.subscriptions.add(this.pedidoService.pedidosAtualizados$.subscribe(() => {
      this.atualizarContadorPedidos();
    }));

    this.subscriptions.add(this.assinaturaEpiService.assinaturasAtualizadas$.subscribe(() => {
      this.atualizarContadorAssinaturasEpi();
    }));

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.atualizarContadorPedidos();
          this.atualizarContadorAssinaturasEpi();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  private atualizarContadorPedidos(): void {
    if (!this.infoUsuario?.nivel_permissao) {
      this.totalPedidosNotificacao = 0;
      return;
    }

    this.pedidoService.contarPedidosNotificacao(this.infoUsuario.nivel_permissao).subscribe({
      next: (total) => {
        this.totalPedidosNotificacao = total;
      },
      error: () => {
        this.totalPedidosNotificacao = 0;
      }
    });
  }

  private atualizarContadorAssinaturasEpi(): void {
    const nivel = this.infoUsuario?.nivel_permissao;
    const podeVerAssinaturas = ['administrador', 'moderador', 'almoxarifado'].includes(nivel);

    if (!podeVerAssinaturas) {
      this.totalAssinaturasEpiAbertas = 0;
      return;
    }

    this.assinaturaEpiService.contarCompetenciasAbertas().subscribe({
      next: (total) => {
        this.totalAssinaturasEpiAbertas = total;
      },
      error: () => {
        this.totalAssinaturasEpiAbertas = 0;
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.settings-wrapper')) {
      this.closeSettings();
    }
  }
}
