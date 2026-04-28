import { TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ItemService } from '../../../services/item.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-modal-tipo-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-tipo-item.component.html',
  styleUrl: './modal-tipo-item.component.scss'
})
export class ModalTipoItemComponent {
 mostrarModal = false;
  novoTipoNome = '';
  carregando = false;

  @Output() tipoCriado = new EventEmitter<TipoItem>();

  constructor(
    private itemService: ItemService,
    private snackbar: SnackbarService
  ) {}

  abrir() {
    this.mostrarModal = true;
    this.novoTipoNome = '';
  }

  fechar() {
    this.mostrarModal = false;
  }

  criarTipoItem() {
    if (!this.novoTipoNome.trim()) {
      this.snackbar.show('Informe um nome válido.', 'warning');
      return;
    }

    this.carregando = true;
    this.itemService.criarTipoItem({
      nome: this.novoTipoNome.trim(),
      grupo_secundario: false,
    }).subscribe({
      next: (res) => {
        this.snackbar.show('Tipo de item criado com sucesso.', 'success');
        this.carregando = false;
        this.fechar();
        this.tipoCriado.emit(res);
      },
      error: (err) => {
        this.carregando = false;
        console.error(err);
        this.snackbar.show('Erro ao criar tipo de item.', 'error');
      }
    });
  }

}
