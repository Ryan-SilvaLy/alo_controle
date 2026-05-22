import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Injectable } from '@angular/core';
import { Item } from './../../services/item.service';
import { AssinaturaEpiRelatorio } from '../../services/assinatura-epi.service';
import { SnackbarService } from '../snackbar/snackbar.service';
import { AuthenticationService } from '../../services/authentication.service';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private empresa = 'ALOCAMA';
  private readonly logoAssetPath = '/assets/android-chrome-192x192.png';
  private logoDataUrl: string | null = null;

  constructor(
    private snackbar: SnackbarService,
    private authService: AuthenticationService
  ) { }

  private async criarDocumento(titulo = 'ITENS EM BAIXA NO ESTOQUE'): Promise<jsPDF> {
    const doc = new jsPDF();
    const usuario = this.authService.getUsuarioLogadoValue()?.nome || 'Usuario';

    await this.desenharCabecalho(doc, titulo, [
      ['Empresa', this.empresa],
      ['Gerado por', usuario],
      ['Data/Hora', `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`]
    ]);

    return doc;
  }

  async gerarPdfItensEmBaixa(itens: Item[]): Promise<void> {
    const itensEmBaixa = itens.filter(i => i.quantidade_atual < i.quantidade_minima);
    if (itensEmBaixa.length === 0) {
      this.snackbar.show('Nao ha itens em baixa no estoque.', 'warning');
      return;
    }

    const doc = await this.criarDocumento();

    const tabela = itensEmBaixa.map(item => [
      item.codigo,
      item.nome,
      item.tipo_item.nome,
      item.prateleira_estoque,
      item.quantidade_atual,
      item.quantidade_minima
    ]);

    autoTable(doc, {
      head: [['Codigo', 'Nome', 'Tipo', 'Prateleira', 'Qtd. atual', 'Qtd. minima']],
      body: tabela,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    doc.save(`itens_em_baixa_${new Date().toISOString()}.pdf`);
  }

  async gerarPdfItensEmBaixaPorTipo(itens: Item[], tipo: string): Promise<void> {
    const itensFiltrados = itens.filter(
      i => i.tipo_item.nome === tipo && i.quantidade_atual < i.quantidade_minima
    );

    if (itensFiltrados.length === 0) {
      this.snackbar.show(`Nao ha itens em baixa do tipo "${tipo}".`, 'warning');
      return;
    }

    const doc = await this.criarDocumento(`ITENS EM BAIXA - ${tipo}`);

    const tabela = itensFiltrados.map(item => [
      item.codigo,
      item.nome,
      item.tipo_item.nome,
      item.prateleira_estoque,
      item.quantidade_atual,
      item.quantidade_minima
    ]);

    autoTable(doc, {
      head: [['Codigo', 'Nome', 'Tipo', 'Prateleira', 'Qtd. atual', 'Qtd. minima']],
      body: tabela,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    doc.save(`itens_em_baixa_${tipo}_${new Date().toISOString()}.pdf`);
  }

  async gerarPdfAssinaturaEpi(relatorio: AssinaturaEpiRelatorio): Promise<void> {
    const doc = new jsPDF();
    const usuario = this.authService.getUsuarioLogadoValue()?.nome || 'Usuario';
    const dataGeracao = new Date(relatorio.gerado_em);
    const assinaturaData = relatorio.assinado_em ? new Date(relatorio.assinado_em) : null;

    await this.desenharCabecalho(doc, 'CONTROLE DE ASSINATURAS DE EPI', [
      ['Solicitante', relatorio.solicitante_nome],
      ['Competencia', relatorio.competencia_label],
      ['Relatorio', relatorio.sequencia_relatorio],
      ['Gerado em', `${dataGeracao.toLocaleDateString('pt-BR')} ${dataGeracao.toLocaleTimeString('pt-BR')}`],
      ['Gerado por', relatorio.gerado_por_nome || usuario],
      ['Status', relatorio.status_assinatura === 'assinado' ? 'ASSINADO' : 'PENDENTE']
    ]);

    const tabela = relatorio.itens.map(item => [
      new Date(item.lancamento.data_saida).toLocaleDateString('pt-BR'),
      item.lancamento.numero_bloco_requisicao,
      item.lancamento.nome_item_snapshot,
      item.lancamento.quantidade,
      item.lancamento.ca_utilizado || item.lancamento.patrimonio_snapshot || '-',
    ]);

    autoTable(doc, {
      startY: 52,
      head: [['Data saida', 'Bloco/Requisicao', 'Item', 'Quantidade', 'C.A.']],
      body: tabela.length ? tabela : [['-', '-', 'Nenhum item encontrado', '-', '-']],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [32, 94, 73], textColor: 255 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setDrawColor(120);
    doc.line(14, finalY + 24, 110, finalY + 24);
    doc.text('Assinatura do funcionario', 14, finalY + 30);

    doc.setFontSize(10);
    doc.text(
      `Status: ${relatorio.status_assinatura === 'assinado' ? 'ASSINADO' : 'PENDENTE ASSINATURA'}`,
      14,
      finalY + 40
    );
    doc.text(
      `Data assinatura: ${assinaturaData ? assinaturaData.toLocaleDateString('pt-BR') : '---'}`,
      14,
      finalY + 46
    );

    doc.save(
      `assinatura_epi_${relatorio.solicitante_nome}_${relatorio.competencia_label.replace('/', '_')}_relatorio_${relatorio.sequencia_relatorio}.pdf`
    );
  }

  async gerarPdfCodigosBarras(itens: Item[]): Promise<void> {
    if (!itens.length) {
      this.snackbar.show('Selecione ao menos um item para imprimir.', 'warning');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const margem = 8;
    const colunas = 3;
    const larguraEtiqueta = (larguraPagina - margem * 2) / colunas;
    const alturaEtiqueta = 30;

    for (let index = 0; index < itens.length; index++) {
      const item = itens[index];
      const coluna = index % colunas;
      const linha = Math.floor((index % 27) / colunas);

      if (index > 0 && index % 27 === 0) {
        doc.addPage();
      }

      const x = margem + coluna * larguraEtiqueta;
      const y = margem + linha * alturaEtiqueta;

      doc.setDrawColor(210, 214, 220);
      doc.rect(x, y, larguraEtiqueta - 1, alturaEtiqueta - 1);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(this.limitarTexto(item.nome, 28), x + 2, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.text(`${item.codigo} | ${item.tipo_item?.nome || ''}`, x + 2, y + 8);

      if (item.codigo_barras_imagem_base64) {
        doc.addImage(
          `data:image/png;base64,${item.codigo_barras_imagem_base64}`,
          'PNG',
          x + 2,
          y + 10,
          larguraEtiqueta - 5,
          14
        );
      }

      doc.setFontSize(7);
      doc.text(String(item.codigo_barras || ''), x + larguraEtiqueta / 2, y + 27, { align: 'center' });

      if (y + alturaEtiqueta > alturaPagina - margem) {
        continue;
      }
    }

    doc.save(`codigos_barras_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  private limitarTexto(texto: string, tamanho: number): string {
    const valor = String(texto || '');
    return valor.length > tamanho ? `${valor.slice(0, tamanho - 3)}...` : valor;
  }

  private limitarTextoPorLargura(doc: jsPDF, texto: string, larguraMaxima: number): string {
    const valor = String(texto || '');
    if (doc.getTextWidth(valor) <= larguraMaxima) {
      return valor;
    }

    let limite = valor.length - 1;
    while (limite > 3 && doc.getTextWidth(`${valor.slice(0, limite)}...`) > larguraMaxima) {
      limite--;
    }

    return `${valor.slice(0, Math.max(limite, 3))}...`;
  }

  private async desenharCabecalho(doc: jsPDF, titulo: string, campos: Array<[string, string | number | null | undefined]>): Promise<void> {
    const larguraPagina = doc.internal.pageSize.getWidth();
    const margem = 12;
    const logo = 22;
    const topo = 8;
    const linhas = campos.length > 4 ? 2 : 1;
    const altura = linhas > 1 ? 38 : 30;

    doc.setDrawColor(180, 190, 205);
    doc.setLineWidth(0.2);
    doc.rect(margem, topo, larguraPagina - margem * 2, altura);
    await this.desenharLogo(doc, margem + 3, topo + 3, logo);

    doc.setTextColor(20, 28, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(titulo, margem + logo + 9, topo + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    const xInicio = margem + logo + 8;
    const larguraUtil = larguraPagina - margem * 2 - logo - 11;
    const colunas = linhas > 1 ? 3 : campos.length;
    const largurasColuna = linhas > 1
      ? [larguraUtil * 0.34, larguraUtil * 0.46, larguraUtil * 0.2]
      : Array(colunas).fill(larguraUtil / colunas);
    const deslocamentosColuna = largurasColuna.reduce<number[]>((acc, largura, index) => {
      acc.push(index === 0 ? 0 : acc[index - 1] + largurasColuna[index - 1]);
      return acc;
    }, []);
    const yBase = topo + 20;

    campos.forEach(([rotulo, valor], index) => {
      const coluna = index % colunas;
      const linha = Math.floor(index / colunas);
      const x = xInicio + deslocamentosColuna[coluna];
      const y = yBase + linha * 6.5;
      const texto = `${rotulo}: ${String(valor ?? '-')}`;
      doc.text(this.limitarTextoPorLargura(doc, texto, largurasColuna[coluna] - 2), x, y);
    });
  }

  private async desenharLogo(doc: jsPDF, x: number, y: number, tamanho: number): Promise<void> {
    const dataUrl = await this.obterLogoDataUrl();
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, 'PNG', x, y, tamanho, tamanho);
        return;
      } catch {
        // fallback below
      }
    }

    doc.setFillColor(24, 79, 158);
    doc.circle(x + tamanho / 2, y + tamanho / 2, tamanho / 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(4.5);
    doc.text('ALOCAMA', x + tamanho / 2, y + tamanho / 2 + 1.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  private async obterLogoDataUrl(): Promise<string | null> {
    if (this.logoDataUrl) {
      return this.logoDataUrl;
    }

    if (typeof FileReader === 'undefined' || typeof fetch === 'undefined') {
      return null;
    }

    try {
      const response = await fetch(this.logoAssetPath);
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      this.logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      return this.logoDataUrl;
    } catch {
      return null;
    }
  }
}
