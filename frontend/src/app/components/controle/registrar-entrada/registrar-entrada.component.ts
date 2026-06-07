import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Item, ItemService } from './../../../services/item.service';
import { ControleService } from '../../../services/controle.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { AutocompleteSelectComponent } from '../../../shared/autocomplete-select/autocomplete-select.component';

const MENSAGEM_ITEM_INATIVO = 'Este produto está inativo e não pode ser utilizado em novas operações.';

@Component({
  selector: 'app-registrar-entrada',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutocompleteSelectComponent],
  templateUrl: './registrar-entrada.component.html',
  styleUrl: './registrar-entrada.component.scss'
})
export class RegistrarEntradaComponent {
  possuiNotaFiscal = false;
  form: FormGroup;
  itensDisponiveis: Item[] = [];
  itensSelecionados: number[] = [];
  mostrarModalConfirmacao = false;
  modoEdicao = false;
  registroId: number | null = null;
  carregandoRegistro = false;
  recebedoresOptions: string[] = [];
  notasFiscaisOptions: string[] = [];
  fornecedoresOptions: string[] = [];
  cnpjCpfOptions: string[] = [];
  textoLabel = (value: string) => value || '';
  textoValue = (value: string) => value || '';
  itemLabel = (item: Item) => item ? `${item.codigo} - ${item.nome}` : '';
  itemSecondary = (item: Item) => {
    const grupo = item?.tipo_item?.nome ? `Grupo: ${item.tipo_item.nome}` : 'Sem grupo';
    const estoque = `Estoque: ${item?.quantidade_atual ?? 0} ${item?.unidade_medida ?? ''}`.trim();
    const prateleira = item?.prateleira_estoque ? `Prateleira: ${item.prateleira_estoque}` : '';
    return [grupo, estoque, prateleira].filter(Boolean).join(' | ');
  };

  constructor(
    private controleService: ControleService,
    private itemService: ItemService,
    private snackbar: SnackbarService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.form = this.fb.group({
      recebido_por: ['', Validators.required],
      data_movimentacao: [this.getDataAtualInput(), Validators.required],
      observacao: [''],
      possuiNotaFiscal: [false],
      notaFiscal: this.fb.group({
        id: [null],
        numero_nota: [''],
        nome_fornecedor: [''],
        cnpj_cpf: ['']
      }),
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens.filter(item => item.status !== 'inativo');
      this.inicializarModoFormulario();
    });

    this.carregarSugestoesMovimentacao();

    this.form.get('possuiNotaFiscal')?.valueChanges.subscribe(checked => {
      this.possuiNotaFiscal = !!checked;
      if (!checked) {
        this.form.get('notaFiscal')?.patchValue({
          id: this.form.get('notaFiscal')?.get('id')?.value,
          numero_nota: '',
          nome_fornecedor: '',
          cnpj_cpf: ''
        });
      }
    });
  }

  criarItem(): FormGroup {
    return this.fb.group({
      item: [null, Validators.required],
      quantidade: [1, [Validators.required, Validators.min(1)]],
      ca: [''],
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

  getItensSelecionadosForaLinha(indexAtual: number): number[] {
    return this.itensSelecionados.filter((_, i) => i !== indexAtual);
  }

  onItemSelecionado(_index: number) {
    this.atualizarItensSelecionados();
  }

  itemSelecionadoEhEpi(itemId: any): boolean {
    const itemSelecionado = this.itensDisponiveis.find(item => item.id === Number(itemId));
    return itemSelecionado?.tipo_item?.nome?.trim().toUpperCase() === 'EPI';
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
      this.snackbar.show('Adicione ao menos um item à entrada.', 'warning');
      return;
    }

    const possuiItemInativo = this.form.value.itens.some((itemForm: any) => {
      const item = this.itensDisponiveis.find(itemDisponivel => itemDisponivel.id === Number(itemForm.item));
      return item?.status === 'inativo';
    });

    if (possuiItemInativo) {
      this.snackbar.show(MENSAGEM_ITEM_INATIVO, 'error');
      return;
    }

    this.mostrarModalConfirmacao = true;
  }

  cancelarConfirmacao() {
    this.mostrarModalConfirmacao = false;
  }

  confirmarEnvio() {
    this.mostrarModalConfirmacao = false;

    if (this.modoEdicao) {
      this.salvarEdicao();
      return;
    }

    const possuiNotaFiscal = this.form.get('possuiNotaFiscal')?.value;

    if (possuiNotaFiscal) {
      this.controleService.criarNotaFiscal(this.getDadosNotaFiscal()).subscribe({
        next: nota => this.salvarNovaEntrada(nota.id),
        error: err => this.exibirErroEntrada(err, 'Não foi possível criar a nota fiscal.')
      });
      return;
    }

    this.salvarNovaEntrada(null);
  }

  onlyNumbers(event: KeyboardEvent) {
    const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab'];
    if (allowedKeys.includes(event.key)) {
      return;
    }
    const regex = /^[0-9]$/;
    if (!regex.test(event.key)) {
      event.preventDefault();
    }
  }

  getItemNome(itemId: number | string): string {
    const id = Number(itemId);
    const item = this.itensDisponiveis.find(i => i.id === id);
    return item ? `${item.codigo} - ${item.nome}` : 'Item desconhecido';
  }

  get podeConfirmar(): boolean {
    const possuiItemValido = this.itens.controls.some(c => c.get('item')?.value);
    const recebidoPorPreenchido = !!this.form.get('recebido_por')?.value?.trim();
    return possuiItemValido && recebidoPorPreenchido;
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

    this.controleService.obterEntradaEstoque(id).subscribe({
      next: (entrada) => {
        const notaDetalhe = entrada.nota_fiscal_detalhe;
        const possuiNota = !!entrada.nota_fiscal;

        this.form.patchValue({
          recebido_por: entrada.recebido_por ?? '',
          data_movimentacao: this.formatarDataInput(entrada.data_movimentacao || entrada.data_entrada),
          observacao: entrada.observacao ?? '',
          possuiNotaFiscal: possuiNota,
          notaFiscal: {
            id: notaDetalhe?.id ?? null,
            numero_nota: notaDetalhe?.numero_nota ?? '',
            nome_fornecedor: notaDetalhe?.nome_fornecedor ?? '',
            cnpj_cpf: notaDetalhe?.cnpj_cpf ?? ''
          }
        });

        this.possuiNotaFiscal = possuiNota;
        this.itens.clear();

        const itens = entrada.itens?.length ? entrada.itens : [null];
        itens.forEach((item: any) => {
          this.itens.push(this.fb.group({
            item: [item?.item ?? null, Validators.required],
            quantidade: [item?.quantidade ?? 1, [Validators.required, Validators.min(1)]],
            ca: [item?.ca ?? ''],
          }));
        });

        this.atualizarItensSelecionados();
        this.carregandoRegistro = false;
      },
      error: () => {
        this.carregandoRegistro = false;
        this.snackbar.show('Não foi possível carregar a entrada para edição.', 'error');
        this.router.navigate(['/controle/iniciar']);
      }
    });
  }

  private salvarNovaEntrada(notaFiscalId: number | null) {
    const payload = this.getPayloadEntrada(notaFiscalId);

    this.controleService.registrarEntradaEstoque(payload).subscribe({
      next: () => {
        this.form.reset();
        this.itens.clear();
        this.adicionarItem();
        this.snackbar.show(
          notaFiscalId ? 'Entrada registrada com nota fiscal.' : 'Entrada registrada sem nota fiscal.',
          'success'
        );
        this.router.navigate(['/controle/iniciar']);
      },
      error: err => this.exibirErroEntrada(err, notaFiscalId ? 'Não foi possível registrar a entrada com nota fiscal.' : 'Não foi possível registrar a entrada.')
    });
  }

  private salvarEdicao() {
    if (!this.registroId) {
      return;
    }

    const possuiNotaFiscal = this.form.get('possuiNotaFiscal')?.value;
    const notaFiscalId = this.form.get('notaFiscal')?.get('id')?.value;

    const concluirAtualizacao = (novoNotaFiscalId: number | null) => {
      this.controleService.atualizarEntradaEstoque(this.registroId!, this.getPayloadEntrada(novoNotaFiscalId)).subscribe({
        next: () => {
          this.snackbar.show('Entrada atualizada com sucesso.', 'success');
          this.router.navigate(['/controle/iniciar']);
        },
        error: err => this.exibirErroEntrada(err, 'Não foi possível atualizar a entrada.')
      });
    };

    if (!possuiNotaFiscal) {
      concluirAtualizacao(null);
      return;
    }

    const requisicaoNota = notaFiscalId
      ? this.controleService.atualizarNotaFiscal(notaFiscalId, this.getDadosNotaFiscal())
      : this.controleService.criarNotaFiscal(this.getDadosNotaFiscal());

    requisicaoNota.subscribe({
      next: nota => concluirAtualizacao(nota.id),
      error: err => this.exibirErroEntrada(err, 'Não foi possível salvar a nota fiscal.')
    });
  }

  private getPayloadEntrada(notaFiscalId: number | null) {
    return {
      nota_fiscal: notaFiscalId,
      recebido_por: this.form.value.recebido_por,
      data_movimentacao: this.form.value.data_movimentacao,
      observacao: this.form.value.observacao,
      itens: this.form.value.itens
    };
  }

  private getDadosNotaFiscal() {
    return {
      numero_nota: this.form.value.notaFiscal.numero_nota,
      nome_fornecedor: this.form.value.notaFiscal.nome_fornecedor,
      cnpj_cpf: this.form.value.notaFiscal.cnpj_cpf
    };
  }

  private carregarSugestoesMovimentacao() {
    this.controleService.listarMovimentacoesEstoque().subscribe({
      next: (movimentacoes) => {
        const entradas = movimentacoes?.entradas || [];

        this.recebedoresOptions = this.getValoresUnicos(
          entradas.map((entrada: any) => entrada.recebido_por)
        );
        this.notasFiscaisOptions = this.getValoresUnicos(
          entradas.map((entrada: any) => entrada.nota_fiscal_detalhe?.numero_nota)
        );
        this.fornecedoresOptions = this.getValoresUnicos(
          entradas.map((entrada: any) => entrada.nota_fiscal_detalhe?.nome_fornecedor)
        );
        this.cnpjCpfOptions = this.getValoresUnicos(
          entradas.map((entrada: any) => entrada.nota_fiscal_detalhe?.cnpj_cpf)
        );
      },
      error: () => {
        this.recebedoresOptions = [];
        this.notasFiscaisOptions = [];
        this.fornecedoresOptions = [];
        this.cnpjCpfOptions = [];
      }
    });
  }

  private getValoresUnicos(valores: any[]): string[] {
    return Array.from(new Set(
      valores
        .map(valor => String(valor || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }

  private getDataAtualInput(): string {
    return this.formatarDataInput(new Date());
  }

  private formatarDataInput(data: string | Date): string {
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
      return data.slice(0, 10);
    }

    const dataObj = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(dataObj.getTime())) {
      return this.formatarDataInput(new Date());
    }

    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private exibirErroEntrada(err: any, mensagemPadrao: string) {
    if (err.status === 400 && err.error) {
      for (const key in err.error) {
        if (err.error.hasOwnProperty(key)) {
          const messages = err.error[key];
          this.snackbar.show(Array.isArray(messages) ? messages.join(', ') : messages, 'error');
        }
      }
      return;
    }

    this.snackbar.show(mensagemPadrao, 'error');
  }
}
