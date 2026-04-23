import { CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';


export const authGuard: CanActivateFn = () => {
  /**
   * Guarda de rota que protege rotas que requerem autenticação.
   * 
   * Verifica se o usuário está logado observando o estado do AuthenticationService.
   * - Se estiver logado (token válido), permite o acesso retornando `true`.
   * - Caso contrário, redireciona o usuário para a rota de login ('/') e bloqueia o acesso retornando `false`.
   * 
   * @returns Observable<boolean> - Emite `true` para permitir acesso, ou `false` para negar.
   */
  
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  return authService.isLoggedIn().pipe(
    map((loggedIn) => {
      if (loggedIn) {
        return true;
      } else {
        router.navigate(['/login']); // Redireciona para a página de login
        return false;
      }
    })
  );
};

export const permissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const router = inject(Router);
  const permissoesPermitidas: string[] = route.data['permissoes'];

  return authService.getUsuarioLogadoSubject().pipe(
    take(1),
    map(usuario => {
      if (!usuario) {
        router.navigate(['/login']);
        return false;
      }

      if (permissoesPermitidas.includes(usuario.nivel_permissao)) {
        console.log(`Permissão concedida para o usuário: ${usuario.nivel_permissao}`);
        return true;
      }

      router.navigate(['/item/iniciar']);
      console.warn(`Acesso negado: Permissão ${usuario.nivel_permissao} insuficiente para acessar esta rota.`);
      return false;
    })
  );
};