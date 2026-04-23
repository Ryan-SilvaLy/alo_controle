import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Item, ItemService } from '../../../services/item.service';
import { ControleService } from '../../../services/controle.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ProdutoService } from '../../../services/produto.service';

@Component({
  selector: 'app-registrar-saida',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-saida.component.html',
  styleUrl: './registrar-saida.component.scss'
})
export class RegistrarSaidaComponent {
  form: FormGroup;
  itensDisponiveis: Item[] = [];
  itensSelecionados: number[] = [];
  mostrarModalConfirmacao = false;
  patrimonios: any[] = [];
  modoEdicao = false;
  registroId: number | null = null;
  carregandoRegistro = false;

  constructor(
    private fb: FormBuilder,
    private itemService: ItemService,
    private controleService: ControleService,
    private snackbar: SnackbarService,
    private router: Router,
    private produtoService: ProdutoService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      bloco_requisicao: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      setor: ['', Validators.required],
      responsavel: ['', Validators.required],
      observacao: [''],
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens;
      this.inicializarModoFormulario();
    });

    this.produtoService.listarProdutos().subscribe(patrimonios => {
      this.patrimonios = patrimonios;
    });
  }

  criarItem(): FormGroup {
    return this.fb.group({
      item: [null, Validators.required],
      quantidade: [1, [Validators.required, Validators.min(1)]],
      solicitante: ['', Validators.required],
      patrimonio: ['']
    });
  }

  get itens(): FormArray {
    return this.form.get('itens') as FormArray;
  }

  adicionarItem() {
    this.itens.push(this.criarItem());
  }

  removerItem(index: number) {
    this.itens.removeAt(index);
    this.atualizarItensSelecionados();
  }

  getItensDisponiveisParaSelect(indexAtual: number): Item[] {
    const idsSelecionados = this.itensSelecionados.filter((_, i) => i !== indexAtual);
    return this.itensDisponiveis.filter(item => !idsSelecionados.includes(item.id));
  }

  onItemSelecionado(_index: number) {
    this.atualizarItensSelecionados();
  }

  atualizarItensSelecionados() {
    this.itensSelecionados = this.itens.controls
      .map(c => +c.get('item')?.value)
      .filter(v => !isNaN(v));
  }

  confirmar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.itens.length === 0) {
      this.snackbar.show('Você deve adicionar ao menos um item à saída.', 'warning');
      return;
    }

    this.mostrarModalConfirmacao = true;
  }

  cancelarConfirmacao() {
    this.mostrarModalConfirmacao = false;
  }

  confirmarEnvio() {
    this.mostrarModalConfirmacao = false;

    const saidaData = {
      bloco_requisicao: this.form.value.bloco_requisicao,
      setor: this.form.value.setor,
      responsavel: this.form.value.responsavel,
      observacao: this.form.value.observacao,
      itens: this.form.value.itens
    };

    const requisicao = this.modoEdicao && this.registroId
      ? this.controleService.atualizarSaidaEstoque(this.registroId, saidaData)
      : this.controleService.registrarSaidaEstoque(saidaData);
    const possuiItemEpi = this.form.value.itens.some((itemForm: any) => this.itemSelecionadoEhEpi(itemForm.item));

    requisicao.subscribe({
      next: () => {
        this.form.reset();
        this.itens.clear();
        this.adicionarItem();
        this.snackbar.show(this.modoEdicao ? 'Saída atualizada com sucesso!' : 'Saída registrada com sucesso!', 'success');
        if (possuiItemEpi) {
          this.snackbar.show('Retirada de EPI registrada no controle de assinaturas.', 'info');
        }
        this.router.navigate(['/controle/iniciar']);
      },
      error: err => this.exibirErroSaida(err)
    });
  }

  temItemValido(): boolean {
    return this.itens.controls.some(i => i.get('item')?.value && i.get('quantidade')?.value > 0);
  }

  getItemNome(itemId: any): string {
    const id = Number(itemId);
    const item = this.itensDisponiveis.find(i => i.id === id);
    return item ? `${item.codigo} - ${item.nome}` : 'Item desconhecido';
  }

  getPatrimonioNome(patrimonioId: any): string {
    const id = Number(patrimonioId);
    const p = this.patrimonios.find(x => x.id === id);
    return p ? `${p.patrimonio} - ${p.nome}` : 'Patrimônio desconhecido';
  }

  private itemSelecionadoEhEpi(itemId: any): boolean {
    const itemSelecionado = this.itensDisponiveis.find(item => item.id === Number(itemId));
    return itemSelecionado?.tipo_item?.nome?.trim().toUpperCase() === 'EPI';
  }

  private inicializarModoFormulario() {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.modoEdicao = true;
      this.registroId = Number(idParam);
      this.carregarRegistro(this.registroId);
      return;
    }

    this.adicionarItem();
    this.onItemSelecionado(0);
  }

  private carregarRegistro(id: number) {
    this.carregandoRegistro = true;

    this.controleService.obterSaidaEstoque(id).subscribe({
      next: (saida) => {
        this.form.patchValue({
          bloco_requisicao: saida.bloco_requisicao ?? '',
          setor: saida.setor ?? '',
          responsavel: saida.responsavel ?? '',
          observacao: saida.observacao ?? ''
        });

        this.itens.clear();

        const itens = saida.itens?.length ? saida.itens : [null];
        itens.forEach((item: any) => {
          this.itens.push(this.fb.group({
            item: [item?.item ?? null, Validators.required],
            quantidade: [item?.quantidade ?? 1, [Validators.required, Validators.min(1)]],
            solicitante: [item?.solicitante ?? '', Validators.required],
            patrimonio: [item?.patrimonio ?? '']
          }));
        });

        this.atualizarItensSelecionados();
        this.carregandoRegistro = false;
      },
      error: () => {
        this.carregandoRegistro = false;
        this.snackbar.show('Erro ao carregar a saída para edição.', 'error');
        this.router.navigate(['/controle/iniciar']);
      }
    });
  }

  private exibirErroSaida(err: any) {
    if (err.status === 400 && err.error && typeof err.error === 'object') {
      const mensagens: string[] = [];

      for (const key in err.error) {
        if (Object.prototype.hasOwnProperty.call(err.error, key)) {
          const msgs = err.error[key];
          if (Array.isArray(msgs)) {
            mensagens.push(...msgs);
          } else if (typeof msgs === 'string') {
            mensagens.push(msgs);
          }
        }
      }

      const mensagemFinal = mensagens.length > 0
        ? mensagens.join(', ')
        : 'Erro de validação no backend.';

      this.snackbar.show(mensagemFinal, 'error');
      return;
    }

    if (err.error && err.error.detail) {
      this.snackbar.show(err.error.detail, 'error');
      return;
    }

    this.snackbar.show('Erro desconhecido. Por favor, tente novamente.', 'error');
  }
}
