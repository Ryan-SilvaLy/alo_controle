import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  // Observable do usuário logado (reativo)
  usuarioLogado: Observable<any>;

  constructor(private authService: AuthenticationService) {
    // Inicializa aqui, após o Angular injetar o authService.
    this.usuarioLogado = this.authService.getUsuarioLogadoSubject();
  }

  /**
   * Verifica se o usuário tem alguma das permissões fornecidas
   */
  hasPermission(permissoes: string[]): boolean {
    const usuario = this.authService.getUsuarioLogadoValue();
    if (!usuario?.nivel_permissao) return false;
    return permissoes
      .map(p => p.toLowerCase().trim())
      .includes(usuario.nivel_permissao.toLowerCase().trim());
  }
}