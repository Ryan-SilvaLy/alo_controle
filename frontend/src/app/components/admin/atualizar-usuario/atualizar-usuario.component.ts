import { Component, OnInit } from '@angular/core';
import { AdminService, Usuario } from './../../../services/admin.service';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-atualizar-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './atualizar-usuario.component.html',
  styleUrls: ['./atualizar-usuario.component.scss']
})
export class AtualizarUsuarioComponent implements OnInit {

  usuario!: Usuario;

  niveisPermissao = [
    { valor: 'moderador', label: 'Moderador' },
    { valor: 'almoxarifado', label: 'Almoxarifado' },
    { valor: 'compra', label: 'Compra' },
    { valor: 'comercial', label: 'Comercial' }
  ];

  constructor(
    private adminService: AdminService,
    private router: Router,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    const usuarioSelecionado = this.adminService.getUsuarioSelecionado();

    if (!usuarioSelecionado) {
      this.snackbar.show('Nenhum usuário selecionado para edição.', 'info');
      this.router.navigate(['/admin/iniciar']);
      return;
    }

    this.usuario = { ...usuarioSelecionado };
  }

  voltarParaLogins(): void {
    this.router.navigate(['/admin/iniciar']);
  }

  atualizarUsuario(): void {
    this.adminService.atualizarUsuario(this.usuario.id, this.usuario).subscribe({
      next: () => {
        this.snackbar.show('Usuário atualizado com sucesso.', 'success');
        this.router.navigate(['/admin/iniciar']);
      },
      error: (err) => {
        console.error(err);
        this.snackbar.show('Erro ao atualizar usuário.', 'error');
      }
    });
  }
}
