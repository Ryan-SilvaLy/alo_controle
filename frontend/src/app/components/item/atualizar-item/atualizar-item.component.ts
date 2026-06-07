import { TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ItemService, Item } from '../../../services/item.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';


@Component({
  selector: 'app-atualizar-item',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalTipoItemComponent],
  templateUrl: './atualizar-item.component.html',
  styleUrls: ['./atualizar-item.component.scss']
})
export class AtualizarItemComponent implements OnInit {
    @Output() itemAtualizado = new EventEmitter<void>(); // evento para avisar o pai
    @Output() modalFechado = new EventEmitter<void>();

  form!: FormGroup;
  tiposItem: TipoItem[] = [];
  itemId!: number;
  mostrarModal = false; // controla o modal
  mostrarModalSenha = false;
  senhaAtualizacao = '';
  senhaAtualizacaoReadOnly = true;
  senhaAtualizacaoAutocompleteName = `senha_atualizacao_${Date.now()}`;
  validandoSenha = false;

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
      status: ['ativo', Validators.required],
    });
  }

  carregarTiposItem(): void {
    this.itemService.listarTipoItem().subscribe({
      next: (res) => this.tiposItem = res,
      error: () => this.snackbar.show('Não foi possível carregar os tipos de item.', 'error')
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
            status: item.status || 'ativo',
          });
        } else {
          this.snackbar.show('Item não encontrado.', 'error');
          this.router.navigate(['/item/iniciar']);
        }
      },
      error: () => this.snackbar.show('Não foi possível carregar os itens.', 'error')
    });
  }

abrirModal(itemId: number) {
  this.itemId = itemId;
  this.senhaAtualizacao = '';
  this.senhaAtualizacaoReadOnly = true;
  this.senhaAtualizacaoAutocompleteName = `senha_atualizacao_${itemId}_${Date.now()}`;
  this.mostrarModalSenha = true;
  this.mostrarModal = false;

  setTimeout(() => {
    this.senhaAtualizacao = '';
  }, 150);
}


validarSenhaEAbrirModal() {
  if (!this.senhaAtualizacao.trim()) {
    this.snackbar.show('Informe sua senha para atualizar o item.', 'warning');
    return;
  }

  this.validandoSenha = true;

  this.itemService.validarSenhaAtualizacaoItem(this.itemId, this.senhaAtualizacao).subscribe({
    next: () => {
      this.validandoSenha = false;
      this.mostrarModalSenha = false;
      this.senhaAtualizacao = '';
      this.carregarItem();
      this.mostrarModal = true;
    },
    error: (err) => {
      this.validandoSenha = false;
      this.snackbar.show(err?.error?.detail || 'Não foi possível validar a senha.', 'error');
    }
  });
}

fecharModalSenha() {
  this.mostrarModalSenha = false;
  this.senhaAtualizacao = '';
  this.senhaAtualizacaoReadOnly = true;
  this.modalFechado.emit();
}

prepararCampoSenhaAtualizacao() {
  this.senhaAtualizacaoReadOnly = false;
  this.senhaAtualizacao = '';
}

fecharModal(emitirFechamento = true) {
  this.mostrarModal = false;
  this.form.reset({
    codigo: '',
    nome: '',
    descricao: '',
    tipo_item_id: null,
    prateleira_estoque: '',
    quantidade_atual: 0,
    quantidade_minima: 0,
    valor_unitario: 0,
    unidade_medida: 'un',
    status: 'ativo',
  });

  if (emitirFechamento) {
    this.modalFechado.emit();
  }
}
  atualizar(): void {
    if (this.form.invalid) {
      this.snackbar.show('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    this.itemService.atualizarItem(this.itemId, this.form.value).subscribe({
      next: () => {
        this.snackbar.show('Item atualizado com sucesso.', 'success');
        this.itemAtualizado.emit();
        this.fecharModal(false);
      },
      error: (err) => {
        this.snackbar.show('Não foi possível atualizar o item.', 'error');
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
