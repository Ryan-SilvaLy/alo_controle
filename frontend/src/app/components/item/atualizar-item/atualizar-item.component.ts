import { TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ItemService, Item } from '../../../services/item.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';


@Component({
  selector: 'app-atualizar-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalTipoItemComponent],
  templateUrl: './atualizar-item.component.html',
  styleUrls: ['./atualizar-item.component.scss']
})
export class AtualizarItemComponent implements OnInit {
    @Output() itemAtualizado = new EventEmitter<void>(); // evento para avisar o pai

  form!: FormGroup;
  tiposItem: TipoItem[] = [];
  itemId!: number;
  mostrarModal = false; // controla o modal

  constructor(
    private fb: FormBuilder,
    public itemService: ItemService,
    private router: Router,
    private snackbar: SnackbarService
  ) {}

ngOnInit(): void {
  this.initForm();
  this.carregarTiposItem();
}


  initForm(): void {
    this.form = this.fb.group({
      codigo: ['', [Validators.required, Validators.maxLength(20)]],
      nome: ['', [Validators.required, Validators.maxLength(100)]],
      descricao: ['', Validators.maxLength(200)],
      tipo_item_id: [null, Validators.required],
      prateleira_estoque: ['', Validators.maxLength(50)],
      quantidade_atual: [0, Validators.required],
      quantidade_minima: [0, Validators.required],
      valor_unitario: [0],
      unidade_medida: ['un', Validators.required],
    });
  }

  carregarTiposItem(): void {
    this.itemService.listarTipoItem().subscribe({
      next: (res) => this.tiposItem = res,
      error: () => this.snackbar.show('Erro ao carregar tipos de item', 'error')
    });
  }

  carregarItem(): void {
    this.itemService.listarItens().subscribe({
      next: (itens: Item[]) => {
        const item = itens.find(i => i.id === this.itemId);
        if (item) {
          this.form.patchValue({
            codigo: item.codigo,
            nome: item.nome,
            descricao: item.descricao,
            tipo_item_id: item.tipo_item.id,
            prateleira_estoque: item.prateleira_estoque,
            quantidade_atual: item.quantidade_atual,
            quantidade_minima: item.quantidade_minima,
            valor_unitario: item.valor_unitario,
            unidade_medida: item.unidade_medida,
          });
        } else {
          this.snackbar.show('Item não encontrado', 'error');
          this.router.navigate(['/item/iniciar']);
        }
      },
      error: () => this.snackbar.show('Erro ao carregar itens', 'error')
    });
  }

abrirModal(itemId: number) {
  this.itemId = itemId;
  this.carregarItem(); // carrega os dados do item no form
  this.mostrarModal = true; // exibe o modal
}


fecharModal() {
  this.mostrarModal = false;
}
  atualizar(): void {
    if (this.form.invalid) {
      this.snackbar.show('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    this.itemService.atualizarItem(this.itemId, this.form.value).subscribe({
      next: () => {
        this.snackbar.show('Item atualizado com sucesso!', 'success');
        this.fecharModal();
        this.itemAtualizado.emit();
      },
      error: (err) => {
        this.snackbar.show('Erro ao atualizar item', 'error');
        console.error('Erro ao atualizar item:', err);
      }
    });
  }

  tipoCriado(novoTipo: TipoItem) {
    this.carregarTiposItem();
    this.form.patchValue({ tipo_item_id: novoTipo.id }); // atualiza o select automaticamente
    this.snackbar.show(`Tipo criado: ${novoTipo.nome}`, 'success');
  }

  onGerarCodigoItem() {
    this.form.patchValue({ codigo: Math.floor(Math.random() * 90000000 + 10000000).toString() });
  }

}
