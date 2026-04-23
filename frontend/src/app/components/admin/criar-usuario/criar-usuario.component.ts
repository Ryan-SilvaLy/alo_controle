import { NovoUsuario } from './../../../services/admin.service';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AdminService } from '../../../services/admin.service';
import { Router, RouterLink } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';


export function senhasIguaisValidator(control: AbstractControl) {
  const senha = control.get('password')?.value;
  const confirmar = control.get('confirmarSenha')?.value;
  return senha === confirmar ? null : { senhasDiferentes: true };
}


@Component({
  selector: 'app-criar-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink],
  templateUrl: './criar-usuario.component.html',
  styleUrls: ['./criar-usuario.component.scss']
})
export class CriarUsuarioComponent implements OnInit {
  form!: FormGroup;
  enviado = false;
  sucesso = false;
  erro: string | null = null;

  niveisPermissao = [
    'moderador',
    'almoxarifado',
    'compra',
    'comercial'
  ];

  constructor(
    private fb: FormBuilder, 
    private adminService: AdminService,
    private router: Router,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
  username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_.-]+$/)]],
  nome: ['', [Validators.required,  Validators.pattern(/^[^\d]*$/)]],
  cargo: ['', [Validators.required]],
  setor: ['', [Validators.required]],
  nivel_permissao: ['', Validators.required],
  password: ['', [Validators.required, Validators.minLength(6)]],
  confirmarSenha: ['', Validators.required],
  }, { validators: senhasIguaisValidator });
  }

  criarUsuario(): void {
    this.enviado = true;
    this.erro = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dados: NovoUsuario = this.form.value;

    this.adminService.criarUsuario(dados).subscribe({
      next: () => {
        this.snackbar.show('Usuário criado com sucesso.', 'success')
        this.router.navigate(['/admin/iniciar']);
      },
      error: (err) => {
        console.error('Erro ao criar usuário:', err);
        this.snackbar.show(err.error?.nivel_permissao || 'Erro ao criar usuário.', 'error')
      }
    });
  }
}
