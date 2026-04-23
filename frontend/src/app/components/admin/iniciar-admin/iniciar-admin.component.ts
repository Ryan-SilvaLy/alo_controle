import { Component } from '@angular/core';
import { AdminService, Usuario } from '../../../services/admin.service';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';


@Component({
  selector: 'app-iniciar-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './iniciar-admin.component.html',
  styleUrl: './iniciar-admin.component.scss'
})
export class IniciarAdminComponent {
  usuarios: Usuario[] = [];
  usuarioParaExcluir: Usuario | null = null;

  constructor (
    private adminService: AdminService,
    private router: Router,
  ) {
    this.carregarUsuarios();
    // console.log('data', this.usuarios);
  }

  // no método editarUsuario:
atualizarUsuario(usuario: Usuario) {
  this.adminService.setUsuarioSelecionado(usuario);
  this.router.navigate(['/admin/atualizar-usuario']);
}

carregarUsuarios() {
    this.adminService.listarUsuarios().subscribe({
      next: (data) => this.usuarios = data,
      
      error: (err) => console.error('Erro ao carregar usuários', err)
    });
  }

abrirModalExcluir(usuario: Usuario) {
  this.usuarioParaExcluir = usuario;
}

  fecharModal() {
    this.usuarioParaExcluir = null;
  }

  confirmarDeletar() {
    if (this.usuarioParaExcluir !== null) {
      this.adminService.excluirUsuario(this.usuarioParaExcluir.id).subscribe({
        next: () => {
          this.carregarUsuarios();
          this.fecharModal();
        },
        error: (err) => {
          console.error('Erro ao excluir usuário', err);
          this.fecharModal();
        }
      });
    }
  }
}
