import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ControleService } from '../../../services/controle.service';
import { Item, ItemService } from '../../../services/item.service';
import { PedidoService } from '../../../services/pedido.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

interface DashboardMetric {
  label: string;
  value: number | string;
  note: string;
  tone?: 'default' | 'info' | 'warning' | 'danger';
}

interface EstoqueCritico {
  id: number;
  codigo: string;
  nome: string;
  grupo: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  deficit: number;
}

interface GrupoResumo {
  nome: string;
  itens: number;
  estoque: number;
  entradas: number;
  saidas: number;
  movimentacoes: number;
}

interface FornecedorResumo {
  nome: string;
  documento: string;
  entregas: number;
  notas: number;
  volumes: number;
  ultimaEntrega: string | null;
}

interface PedidoResumo {
  codigo: string;
  grupo: string;
  status: string;
  criadoEm: string | null;
  itens: number;
  setor: string;
}

interface RankingResumo {
  nome: string;
  pedidos: number;
  itens: number;
}

interface ItemSaidaResumo {
  codigo: string;
  nome: string;
  grupo: string;
  quantidadeSaida: number;
  movimentacoes: number;
}

interface CustoResumo {
  valorEstoque: number;
  valorEntradas: number;
  valorSaidas: number;
  saldoPeriodo: number;
  ticketMedioEntrada: number;
  ticketMedioSaida: number;
}

interface EvolucaoCusto {
  periodo: string;
  entradas: number;
  saidas: number;
  saldo: number;
  entradasAltura: number;
  saidasAltura: number;
}

interface GrupoCustoResumo {
  nome: string;
  valorEstoque: number;
  valorSaidas: number;
  percentualEstoque: number;
}

interface FornecedorCustoResumo {
  nome: string;
  documento: string;
  valor: number;
  entradas: number;
}

interface ItemCustoResumo {
  codigo: string;
  nome: string;
  grupo: string;
  quantidadeSaida: number;
  valorSaida: number;
}

interface RadarChartSlice {
  label: string;
  value: number;
  color: string;
  subtitle: string;
}

@Component({
  selector: 'app-dashboard-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard-produto.component.html',
  styleUrl: './dashboard-produto.component.scss'
})
export class DashboardProdutoComponent {
  carregando = true;
  erro: string | null = null;
  periodoSelecionado = 'geral';
  ultimaAtualizacao: Date | null = null;

  metricas: DashboardMetric[] = [];
  estoqueCritico: EstoqueCritico[] = [];
  gruposResumo: GrupoResumo[] = [];
  fornecedoresResumo: FornecedorResumo[] = [];
  pedidosPendentes: PedidoResumo[] = [];
  setoresMaisPedem: RankingResumo[] = [];
  solicitantesMaisPedem: RankingResumo[] = [];
  itensMaisSaem: ItemSaidaResumo[] = [];
  saidaChartSlices: RadarChartSlice[] = [];
  entradaChartSlices: RadarChartSlice[] = [];
  custosResumo: CustoResumo = {
    valorEstoque: 0,
    valorEntradas: 0,
    valorSaidas: 0,
    saldoPeriodo: 0,
    ticketMedioEntrada: 0,
    ticketMedioSaida: 0
  };
  evolucaoCustos: EvolucaoCusto[] = [];
  gruposCustoResumo: GrupoCustoResumo[] = [];
  fornecedoresCustoResumo: FornecedorCustoResumo[] = [];
  itensMaiorCustoSaida: ItemCustoResumo[] = [];

  constructor(
    private itemService: ItemService,
    private controleService: ControleService,
    private pedidoService: PedidoService,
    private snackBar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.carregarDashboard();
  }

  get tituloPeriodo(): string {
    switch (this.periodoSelecionado) {
      case '7d':
        return 'ultimos 7 dias';
      case '30d':
        return 'ultimos 30 dias';
      case '90d':
        return 'ultimos 90 dias';
      default:
        return 'historico completo';
    }
  }

  get statusPendentes(): number {
    return this.pedidosPendentes.length;
  }

  get saidaChartTotal(): number {
    return this.saidaChartSlices.reduce((total, slice) => total + slice.value, 0);
  }

  get saidaChartStyle(): string {
    return this.montarChartStyle(this.saidaChartSlices);
  }

  get entradaChartTotal(): number {
    return this.entradaChartSlices.reduce((total, slice) => total + slice.value, 0);
  }

  get entradaChartStyle(): string {
    return this.montarChartStyle(this.entradaChartSlices);
  }

  get grupoMaisCaroNome(): string {
    return this.gruposCustoResumo.length ? this.gruposCustoResumo[0].nome : '-';
  }

  get fornecedorMaiorCustoNome(): string {
    return this.fornecedoresCustoResumo.length ? this.fornecedoresCustoResumo[0].nome : '-';
  }

  carregarDashboard(): void {
    this.carregando = true;
    this.erro = null;

    forkJoin({
      itens: this.itemService.listarItens(),
      entradas: this.controleService.listarEntradasEstoque(),
      saidas: this.controleService.listarSaidasEstoque(),
      pedidos: this.pedidoService.listarPedidos()
    }).subscribe({
      next: ({ itens, entradas, saidas, pedidos }) => {
        const entradasFiltradas = this.filtrarPorPeriodo(entradas, 'data_entrada');
        const saidasFiltradas = this.filtrarPorPeriodo(saidas, 'data_saida');
        const pedidosLista = Array.isArray(pedidos) ? pedidos : [];

        this.metricas = this.montarMetricas(itens, entradasFiltradas, saidasFiltradas, pedidosLista);
        this.estoqueCritico = this.montarEstoqueCritico(itens);
        this.gruposResumo = this.montarResumoGrupos(itens, entradasFiltradas, saidasFiltradas);
        this.fornecedoresResumo = this.montarFornecedores(entradasFiltradas);
        this.pedidosPendentes = this.montarPedidosPendentes(pedidosLista);
        this.setoresMaisPedem = this.montarRankingPedidos(pedidosLista, 'setor_destino');
        this.solicitantesMaisPedem = this.montarRankingPedidos(pedidosLista, 'solicitante');
        this.itensMaisSaem = this.montarItensMaisSaem(itens, saidasFiltradas);
        this.entradaChartSlices = this.montarEntradaChart(itens, entradasFiltradas);
        this.saidaChartSlices = this.montarSaidaChart(itens, saidasFiltradas);
        this.custosResumo = this.montarResumoCustos(itens, entradasFiltradas, saidasFiltradas);
        this.evolucaoCustos = this.montarEvolucaoCustos(itens, entradasFiltradas, saidasFiltradas);
        this.gruposCustoResumo = this.montarResumoCustosPorGrupo(itens, saidasFiltradas);
        this.fornecedoresCustoResumo = this.montarResumoCustosPorFornecedor(itens, entradasFiltradas);
        this.itensMaiorCustoSaida = this.montarItensMaiorCustoSaida(itens, saidasFiltradas);
        this.ultimaAtualizacao = new Date();
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar dashboard:', err);
        this.erro = 'Nao foi possivel carregar os dados do dashboard.';
        this.snackBar.show(this.erro, 'error');
        this.carregando = false;
      }
    });
  }

  private filtrarPorPeriodo<T extends Record<string, any>>(lista: T[], campoData: string): T[] {
    if (this.periodoSelecionado === 'geral') {
      return lista ?? [];
    }

    const dias = Number(this.periodoSelecionado.replace('d', ''));
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - dias + 1);

    return (lista ?? []).filter((registro) => {
      const data = registro?.[campoData] || registro?.['criado_em'];
      if (!data) {
        return false;
      }

      return new Date(data) >= limite;
    });
  }

  private montarMetricas(itens: Item[], entradas: any[], saidas: any[], pedidos: any[]): DashboardMetric[] {
    const totalItens = itens.length;
    const estoqueTotal = itens.reduce((total, item) => total + Number(item.quantidade_atual || 0), 0);
    const estoqueBaixo = itens.filter((item) => (item.situacao || '').toLowerCase() === 'baixo').length;
    const entradasQuantidade = entradas.reduce((total, entrada) => total + this.somarQuantidadeItens(entrada.itens), 0);
    const saidasQuantidade = saidas.reduce((total, saida) => total + this.somarQuantidadeItens(saida.itens), 0);
    const valorEstoqueAtual = this.calcularValorEstoqueAtual(itens);
    const valorSaidas = this.calcularValorSaidas(itens, saidas);
    const itensComValor = itens.filter((item) => Number(item.valor_unitario || 0) > 0).length;
    const setorMaisAtivo = this.montarRankingPedidos(pedidos, 'setor_destino')[0];
    const solicitanteMaisAtivo = this.montarRankingPedidos(pedidos, 'solicitante')[0];

    return [
      {
        label: 'Itens cadastrados',
        value: totalItens,
        note: `${estoqueTotal} unidades em estoque`,
        tone: 'default'
      },
      {
        label: 'Estoque baixo',
        value: estoqueBaixo,
        note: 'Itens abaixo do minimo',
        tone: estoqueBaixo > 0 ? 'danger' : 'info'
      },
      {
        label: 'Entradas no periodo',
        value: entradasQuantidade,
        note: `${entradas.length} registro(s) de entrada`,
        tone: 'info'
      },
      {
        label: 'Saidas no periodo',
        value: saidasQuantidade,
        note: `${saidas.length} registro(s) de saida`,
        tone: 'warning'
      },
      {
        label: 'Valor do estoque',
        value: this.formatarMoeda(valorEstoqueAtual),
        note: `${itensComValor}/${totalItens} item(ns) com valor unitario`,
        tone: 'info'
      },
      {
        label: 'Valor de saidas',
        value: this.formatarMoeda(valorSaidas),
        note: `${saidasQuantidade} unidade(s) baixadas no periodo`,
        tone: 'warning'
      },
      {
        label: 'Setor que mais pede',
        value: setorMaisAtivo?.nome || '-',
        note: setorMaisAtivo ? `${setorMaisAtivo.pedidos} pedido(s)` : 'Sem registros',
        tone: 'default'
      },
      {
        label: 'Solicitante lider',
        value: solicitanteMaisAtivo?.nome || '-',
        note: solicitanteMaisAtivo ? `${solicitanteMaisAtivo.pedidos} pedido(s)` : 'Sem registros',
        tone: 'info'
      }
    ];
  }

  private montarEstoqueCritico(itens: Item[]): EstoqueCritico[] {
    return itens
      .filter((item) => Number(item.quantidade_atual || 0) <= Number(item.quantidade_minima || 0))
      .map((item) => ({
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        grupo: item.tipo_item?.nome || 'Sem grupo',
        quantidadeAtual: Number(item.quantidade_atual || 0),
        quantidadeMinima: Number(item.quantidade_minima || 0),
        deficit: Math.max(Number(item.quantidade_minima || 0) - Number(item.quantidade_atual || 0), 0)
      }))
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);
  }

  private montarResumoGrupos(itens: Item[], entradas: any[], saidas: any[]): GrupoResumo[] {
    const grupos = new Map<string, GrupoResumo>();

    for (const item of itens) {
      const grupo = item.tipo_item?.nome || 'Sem grupo';
      if (!grupos.has(grupo)) {
        grupos.set(grupo, {
          nome: grupo,
          itens: 0,
          estoque: 0,
          entradas: 0,
          saidas: 0,
          movimentacoes: 0
        });
      }

      const registro = grupos.get(grupo)!;
      registro.itens += 1;
      registro.estoque += Number(item.quantidade_atual || 0);
    }

    for (const entrada of entradas) {
      for (const item of entrada.itens || []) {
        const grupo = this.buscarGrupoDoItem(itens, item.item);
        const registro = grupos.get(grupo);
        if (!registro) continue;
        registro.entradas += Number(item.quantidade || 0);
        registro.movimentacoes += 1;
      }
    }

    for (const saida of saidas) {
      for (const item of saida.itens || []) {
        const grupo = this.buscarGrupoDoItem(itens, item.item);
        const registro = grupos.get(grupo);
        if (!registro) continue;
        registro.saidas += Number(item.quantidade || 0);
        registro.movimentacoes += 1;
      }
    }

    return Array.from(grupos.values())
      .sort((a, b) => b.movimentacoes - a.movimentacoes || b.estoque - a.estoque)
      .slice(0, 6);
  }

  private montarFornecedores(entradas: any[]): FornecedorResumo[] {
    const mapa = new Map<string, { nome: string; documento: string; entregas: number; notas: Set<string>; volumes: number; ultimaEntrega: string | null }>();

    for (const entrada of entradas) {
      const nota = entrada?.nota_fiscal_detalhe;
      if (!nota?.nome_fornecedor && !nota?.cnpj_cpf) continue;

      const nome = (nota?.nome_fornecedor || 'Fornecedor nao informado').trim();
      const documento = (nota?.cnpj_cpf || '-').trim() || '-';
      const chave = `${nome.toLowerCase()}::${documento}`;
      const numeroNota = String(nota?.numero_nota || '-');
      const volumes = this.somarQuantidadeItens(entrada.itens);
      const data = entrada?.data_entrada || entrada?.criado_em || null;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome,
          documento,
          entregas: 0,
          notas: new Set<string>(),
          volumes: 0,
          ultimaEntrega: data
        });
      }

      const registro = mapa.get(chave)!;
      registro.entregas += 1;
      registro.notas.add(numeroNota);
      registro.volumes += volumes;

      if (data && (!registro.ultimaEntrega || new Date(data) > new Date(registro.ultimaEntrega))) {
        registro.ultimaEntrega = data;
      }
    }

    return Array.from(mapa.values())
      .map((fornecedor) => ({
        nome: fornecedor.nome,
        documento: fornecedor.documento,
        entregas: fornecedor.entregas,
        notas: fornecedor.notas.size,
        volumes: fornecedor.volumes,
        ultimaEntrega: fornecedor.ultimaEntrega
      }))
      .sort((a, b) => b.entregas - a.entregas || b.volumes - a.volumes)
      .slice(0, 6);
  }

  private montarPedidosPendentes(pedidos: any[]): PedidoResumo[] {
    return pedidos
      .filter((pedido) => pedido.status === 'pendente' || pedido.status === 'enviado')
      .map((pedido) => ({
        codigo: pedido.codigo_pedido,
        grupo: pedido.tipo_item_nome || 'Sem grupo',
        status: pedido.status,
        criadoEm: pedido.criado_em || null,
        itens: (pedido.itens || []).length,
        setor: pedido.setor_destino || '-'
      }))
      .sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime())
      .slice(0, 6);
  }

  private montarRankingPedidos(pedidos: any[], campo: 'setor_destino' | 'solicitante'): RankingResumo[] {
    const mapa = new Map<string, RankingResumo>();

    for (const pedido of pedidos) {
      const nome = String(pedido?.[campo] || '-').trim() || '-';
      if (!mapa.has(nome)) {
        mapa.set(nome, {
          nome,
          pedidos: 0,
          itens: 0
        });
      }

      const registro = mapa.get(nome)!;
      registro.pedidos += 1;
      registro.itens += (pedido?.itens || []).length;
    }

    return Array.from(mapa.values())
      .sort((a, b) => b.pedidos - a.pedidos || b.itens - a.itens)
      .slice(0, 5);
  }

  private montarItensMaisSaem(itens: Item[], saidas: any[]): ItemSaidaResumo[] {
    const mapa = new Map<number, ItemSaidaResumo>();

    for (const saida of saidas) {
      for (const itemSaida of saida.itens || []) {
        const itemId = Number(itemSaida?.item);
        const item = itens.find((registro) => registro.id === itemId);
        if (!item) continue;

        if (!mapa.has(itemId)) {
          mapa.set(itemId, {
            codigo: item.codigo,
            nome: item.nome,
            grupo: item.tipo_item?.nome || 'Sem grupo',
            quantidadeSaida: 0,
            movimentacoes: 0
          });
        }

        const registro = mapa.get(itemId)!;
        registro.quantidadeSaida += Number(itemSaida?.quantidade || 0);
        registro.movimentacoes += 1;
      }
    }

    return Array.from(mapa.values())
      .sort((a, b) => b.quantidadeSaida - a.quantidadeSaida || b.movimentacoes - a.movimentacoes)
      .slice(0, 8);
  }

  private montarResumoCustos(itens: Item[], entradas: any[], saidas: any[]): CustoResumo {
    const valorEstoque = this.calcularValorEstoqueAtual(itens);
    const valorEntradas = this.calcularValorEntradas(itens, entradas);
    const valorSaidas = this.calcularValorSaidas(itens, saidas);

    return {
      valorEstoque,
      valorEntradas,
      valorSaidas,
      saldoPeriodo: valorEntradas - valorSaidas,
      ticketMedioEntrada: entradas.length ? valorEntradas / entradas.length : 0,
      ticketMedioSaida: saidas.length ? valorSaidas / saidas.length : 0
    };
  }

  private montarEvolucaoCustos(itens: Item[], entradas: any[], saidas: any[]): EvolucaoCusto[] {
    const mapa = new Map<string, { data: Date; entradas: number; saidas: number }>();

    for (const entrada of entradas || []) {
      const data = this.obterDataRegistro(entrada, 'data_entrada');
      if (!data) continue;

      const chave = this.obterChaveMes(data);
      const registro = this.obterRegistroEvolucao(mapa, chave, data);
      registro.entradas += this.calcularValorItensMovimentacao(itens, entrada?.itens || []);
    }

    for (const saida of saidas || []) {
      const data = this.obterDataRegistro(saida, 'data_saida');
      if (!data) continue;

      const chave = this.obterChaveMes(data);
      const registro = this.obterRegistroEvolucao(mapa, chave, data);
      registro.saidas += this.calcularValorItensMovimentacao(itens, saida?.itens || []);
    }

    const maiorValor = Math.max(
      ...Array.from(mapa.values()).flatMap((registro) => [registro.entradas, registro.saidas]),
      1
    );

    return Array.from(mapa.entries())
      .sort((a, b) => a[1].data.getTime() - b[1].data.getTime())
      .slice(-8)
      .map(([periodo, registro]) => ({
        periodo,
        entradas: registro.entradas,
        saidas: registro.saidas,
        saldo: registro.entradas - registro.saidas,
        entradasAltura: this.calcularAlturaBarra(registro.entradas, maiorValor),
        saidasAltura: this.calcularAlturaBarra(registro.saidas, maiorValor)
      }));
  }

  private montarResumoCustosPorGrupo(itens: Item[], saidas: any[]): GrupoCustoResumo[] {
    const mapa = new Map<string, GrupoCustoResumo>();
    const valorEstoqueTotal = this.calcularValorEstoqueAtual(itens);

    for (const item of itens || []) {
      const grupo = item.tipo_item?.nome || 'Sem grupo';
      if (!mapa.has(grupo)) {
        mapa.set(grupo, {
          nome: grupo,
          valorEstoque: 0,
          valorSaidas: 0,
          percentualEstoque: 0
        });
      }

      mapa.get(grupo)!.valorEstoque += Number(item.quantidade_atual || 0) * Number(item.valor_unitario || 0);
    }

    for (const saida of saidas || []) {
      for (const itemSaida of saida?.itens || []) {
        const item = itens.find((registro) => registro.id === Number(itemSaida?.item));
        const grupo = item?.tipo_item?.nome || 'Sem grupo';
        if (!mapa.has(grupo)) continue;

        mapa.get(grupo)!.valorSaidas += Number(itemSaida?.quantidade || 0) * Number(item?.valor_unitario || 0);
      }
    }

    return Array.from(mapa.values())
      .map((grupo) => ({
        ...grupo,
        percentualEstoque: valorEstoqueTotal ? (grupo.valorEstoque / valorEstoqueTotal) * 100 : 0
      }))
      .sort((a, b) => b.valorEstoque - a.valorEstoque || b.valorSaidas - a.valorSaidas)
      .slice(0, 6);
  }

  private montarResumoCustosPorFornecedor(itens: Item[], entradas: any[]): FornecedorCustoResumo[] {
    const mapa = new Map<string, FornecedorCustoResumo>();

    for (const entrada of entradas || []) {
      const nota = entrada?.nota_fiscal_detalhe;
      const nome = String(nota?.nome_fornecedor || entrada?.recebido_por || 'Fornecedor nao informado').trim();
      const documento = String(nota?.cnpj_cpf || '-').trim() || '-';
      const chave = `${nome.toLowerCase()}::${documento}`;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome,
          documento,
          valor: 0,
          entradas: 0
        });
      }

      const registro = mapa.get(chave)!;
      registro.valor += this.calcularValorItensMovimentacao(itens, entrada?.itens || []);
      registro.entradas += 1;
    }

    return Array.from(mapa.values())
      .filter((fornecedor) => fornecedor.valor > 0)
      .sort((a, b) => b.valor - a.valor || b.entradas - a.entradas)
      .slice(0, 6);
  }

  private montarItensMaiorCustoSaida(itens: Item[], saidas: any[]): ItemCustoResumo[] {
    const mapa = new Map<number, ItemCustoResumo>();

    for (const saida of saidas || []) {
      for (const itemSaida of saida?.itens || []) {
        const itemId = Number(itemSaida?.item);
        const item = itens.find((registro) => registro.id === itemId);
        if (!item) continue;

        if (!mapa.has(itemId)) {
          mapa.set(itemId, {
            codigo: item.codigo,
            nome: item.nome,
            grupo: item.tipo_item?.nome || 'Sem grupo',
            quantidadeSaida: 0,
            valorSaida: 0
          });
        }

        const quantidade = Number(itemSaida?.quantidade || 0);
        const registro = mapa.get(itemId)!;
        registro.quantidadeSaida += quantidade;
        registro.valorSaida += quantidade * Number(item.valor_unitario || 0);
      }
    }

    return Array.from(mapa.values())
      .filter((item) => item.valorSaida > 0)
      .sort((a, b) => b.valorSaida - a.valorSaida || b.quantidadeSaida - a.quantidadeSaida)
      .slice(0, 6);
  }

  private montarEntradaChart(itens: Item[], entradas: any[]): RadarChartSlice[] {
    const itemMapa = new Map<number, { codigo: string; nome: string; quantidade: number }>();
    const grupoMapa = new Map<string, number>();
    const fornecedorMapa = new Map<string, number>();

    for (const entrada of entradas) {
      const fornecedor = String(
        entrada?.nota_fiscal_detalhe?.nome_fornecedor || entrada?.recebido_por || 'Sem fornecedor'
      );
      fornecedorMapa.set(fornecedor, (fornecedorMapa.get(fornecedor) || 0) + this.somarQuantidadeItens(entrada?.itens));

      for (const itemEntrada of entrada.itens || []) {
        const itemId = Number(itemEntrada?.item);
        const item = itens.find((registro) => registro.id === itemId);
        if (!item) continue;

        if (!itemMapa.has(itemId)) {
          itemMapa.set(itemId, {
            codigo: item.codigo,
            nome: item.nome,
            quantidade: 0
          });
        }

        const itemRegistro = itemMapa.get(itemId)!;
        itemRegistro.quantidade += Number(itemEntrada?.quantidade || 0);

        const grupo = item.tipo_item?.nome || 'Sem grupo';
        grupoMapa.set(grupo, (grupoMapa.get(grupo) || 0) + Number(itemEntrada?.quantidade || 0));
      }
    }

    const itemLider = Array.from(itemMapa.values()).sort((a, b) => b.quantidade - a.quantidade)[0];
    const grupoLider = Array.from(grupoMapa.entries()).sort((a, b) => b[1] - a[1])[0];
    const fornecedorLider = Array.from(fornecedorMapa.entries()).sort((a, b) => b[1] - a[1])[0];

    return [
      {
        label: itemLider?.nome || 'Sem item',
        value: itemLider?.quantidade || 0,
        color: '#15803d',
        subtitle: itemLider ? `Item - ${itemLider.codigo}` : 'Item'
      },
      {
        label: grupoLider?.[0] || 'Sem grupo',
        value: grupoLider?.[1] || 0,
        color: '#0891b2',
        subtitle: 'Grupo'
      },
      {
        label: fornecedorLider?.[0] || 'Sem fornecedor',
        value: fornecedorLider?.[1] || 0,
        color: '#b45309',
        subtitle: 'Fornecedor'
      }
    ].filter((slice) => slice.value > 0);
  }

  private montarSaidaChart(itens: Item[], saidas: any[]): RadarChartSlice[] {
    const itemLider = this.montarItensMaisSaem(itens, saidas)[0];
    const grupoMapa = new Map<string, number>();
    const setorMapa = new Map<string, number>();

    for (const saida of saidas) {
      const setor = String(saida?.setor || 'Sem setor');
      setorMapa.set(setor, (setorMapa.get(setor) || 0) + this.somarQuantidadeItens(saida?.itens));

      for (const itemSaida of saida.itens || []) {
        const grupo = this.buscarGrupoDoItem(itens, itemSaida.item);
        grupoMapa.set(grupo, (grupoMapa.get(grupo) || 0) + Number(itemSaida?.quantidade || 0));
      }
    }

    const grupoLider = Array.from(grupoMapa.entries()).sort((a, b) => b[1] - a[1])[0];
    const setorLider = Array.from(setorMapa.entries()).sort((a, b) => b[1] - a[1])[0];

    return [
      {
        label: itemLider?.nome || 'Sem item',
        value: itemLider?.quantidadeSaida || 0,
        color: '#0f766e',
        subtitle: itemLider ? `Item - ${itemLider.codigo}` : 'Item'
      },
      {
        label: grupoLider?.[0] || 'Sem grupo',
        value: grupoLider?.[1] || 0,
        color: '#2563eb',
        subtitle: 'Grupo'
      },
      {
        label: setorLider?.[0] || 'Sem setor',
        value: setorLider?.[1] || 0,
        color: '#d97706',
        subtitle: 'Setor'
      }
    ].filter((slice) => slice.value > 0);
  }

  private montarChartStyle(slices: RadarChartSlice[]): string {
    const total = slices.reduce((acc, slice) => acc + slice.value, 0);
    if (!slices.length || !total) {
      return 'conic-gradient(#e2e8f0 0deg 360deg)';
    }

    let acumulado = 0;
    const faixas = slices.map((slice) => {
      const inicio = acumulado;
      const angulo = (slice.value / total) * 360;
      acumulado += angulo;
      return `${slice.color} ${inicio}deg ${acumulado}deg`;
    });

    return `conic-gradient(${faixas.join(', ')})`;
  }

  private somarQuantidadeItens(itens: any[]): number {
    return (itens || []).reduce((total, item) => total + Number(item?.quantidade || 0), 0);
  }

  private calcularValorEstoqueAtual(itens: Item[]): number {
    return (itens || []).reduce((total, item) => {
      return total + (Number(item.quantidade_atual || 0) * Number(item.valor_unitario || 0));
    }, 0);
  }

  private calcularValorSaidas(itens: Item[], saidas: any[]): number {
    return (saidas || []).reduce((totalSaidas, saida) => {
      const totalRegistro = (saida.itens || []).reduce((totalItens: number, itemSaida: any) => {
        const item = itens.find((registro) => registro.id === Number(itemSaida?.item));
        return totalItens + (Number(itemSaida?.quantidade || 0) * Number(item?.valor_unitario || 0));
      }, 0);

      return totalSaidas + totalRegistro;
    }, 0);
  }

  private calcularValorEntradas(itens: Item[], entradas: any[]): number {
    return (entradas || []).reduce((totalEntradas, entrada) => {
      return totalEntradas + this.calcularValorItensMovimentacao(itens, entrada?.itens || []);
    }, 0);
  }

  private calcularValorItensMovimentacao(itens: Item[], itensMovimentacao: any[]): number {
    return (itensMovimentacao || []).reduce((totalItens: number, itemMovimentacao: any) => {
      const item = itens.find((registro) => registro.id === Number(itemMovimentacao?.item));
      return totalItens + (Number(itemMovimentacao?.quantidade || 0) * Number(item?.valor_unitario || 0));
    }, 0);
  }

  private obterRegistroEvolucao(mapa: Map<string, { data: Date; entradas: number; saidas: number }>, chave: string, data: Date) {
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        data,
        entradas: 0,
        saidas: 0
      });
    }

    return mapa.get(chave)!;
  }

  private obterDataRegistro(registro: any, campoData: string): Date | null {
    const valor = registro?.[campoData] || registro?.criado_em;
    if (!valor) {
      return null;
    }

    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  private obterChaveMes(data: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      year: '2-digit'
    }).format(data).replace('.', '');
  }

  private calcularAlturaBarra(valor: number, maiorValor: number): number {
    if (!valor || !maiorValor) {
      return 6;
    }

    return Math.max((valor / maiorValor) * 100, 8);
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  }

  formatarPercentual(valor: number): string {
    return `${(valor || 0).toFixed(1).replace('.', ',')}%`;
  }

  private buscarGrupoDoItem(itens: Item[], itemId: number): string {
    const item = itens.find((registro) => registro.id === Number(itemId));
    return item?.tipo_item?.nome || 'Sem grupo';
  }
}
