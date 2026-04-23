import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy } from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { Subscription } from 'rxjs';
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnDestroy {
  /**
   * Diretiva estrutural para controlar a exibição de elementos com base nas permissões do usuário.
   * 
   * Uso: 
   * <div *appHasPermission="['administrador', 'moderador']">...</div>
   * 
   * A diretiva escuta mudanças no usuário logado e atualiza a visualização dinamicamente.
   * Se o usuário possuir pelo menos uma das permissões passadas como parâmetro, o conteúdo
   * dentro da diretiva será renderizado. Caso contrário, será removido do DOM.
   * 
   * Essa abordagem evita a duplicação de lógica em templates e componentes para controle de acesso.
   * 
   * Implementa OnDestroy para cancelar inscrições e evitar vazamentos de memória.
   */

  private permissoes: string[] = [];
  private sub: Subscription = new Subscription();

    /**
   * Inicializa a diretiva, injeta referências ao template e ao serviço de permissões,
   * e cria uma inscrição para ouvir mudanças no usuário logado, atualizando a view.
   * 
   * @param templateRef - Referência ao template onde a diretiva está aplicada
   * @param viewContainer - Container para renderizar ou limpar o template
   * @param permissionService - Serviço para verificar permissões do usuário
   */
  
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {
    // Escuta mudanças do usuário logado
    this.sub.add(
      this.permissionService.usuarioLogado.subscribe(() => this.updateView())
    );
  }

    /**
   * Setter para a lista de permissões que o elemento requer para ser exibido.
   * 
   * Quando o valor é definido, ele normaliza as permissões (lowercase e trim) 
   * e chama a atualização da visualização.
   * 
   * @param permissoes - Array de strings representando as permissões permitidas
   */
  @Input()
  set appHasPermission(permissoes: string[]) {
    this.permissoes = permissoes.map(p => p.toLowerCase().trim());
    this.updateView();
  }

    /**
   * Atualiza a visualização do template baseado nas permissões do usuário atual.
   * 
   * Se o usuário possui alguma das permissões necessárias, cria a view do template.
   * Caso contrário, limpa o container removendo o conteúdo.
   */
  private updateView() {
      this.viewContainer.clear();  // Limpa as 
    if (this.permissionService.hasPermission(this.permissoes)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }

    /**
   * Cleanup chamado quando a diretiva é destruída.
   * Cancela a inscrição para evitar vazamentos de memória.
   */
  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
