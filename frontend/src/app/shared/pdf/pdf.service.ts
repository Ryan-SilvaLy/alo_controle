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

   private empresa = 'Minha Empresa LTDA'; // valor fixo

  constructor(
    private snackbar: SnackbarService,
    private authService: AuthenticationService // pega o usuário logado
  ) { }

  private criarDocumento(): jsPDF {
    const doc = new jsPDF();
    const usuario = this.authService.getUsuarioLogadoValue()?.nome || 'Usuário';

    // Cabeçalho fixo
    doc.setFontSize(16);
    doc.text(this.empresa, 14, 15);
    doc.setFontSize(12);
    doc.text(`Relatório gerado por: ${usuario}`, 14, 22);
    doc.text(`Data/Hora: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);
    doc.setFontSize(10);
    doc.text('Itens em Baixa no Estoque', 14, 35);

    return doc;
  }

  gerarPdfItensEmBaixa(itens: Item[]): void {
    const itensEmBaixa = itens.filter(i => i.quantidade_atual < i.quantidade_minima);
    if (itensEmBaixa.length === 0) {
      this.snackbar.show('Não há itens em baixa no estoque.', 'warning');
      return;
    }

    const doc = this.criarDocumento();

    const tabela = itensEmBaixa.map(item => [
      item.codigo,
      item.nome,
      item.tipo_item.nome,
      item.prateleira_estoque,
      item.quantidade_atual,
      item.quantidade_minima
    ]);

    autoTable(doc, {
      head: [['Código', 'Nome', 'Tipo', 'Prateleira', 'Qtd Atual', 'Qtd Mínima']],
      body: tabela,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    doc.save(`itens_em_baixa_${new Date().toISOString()}.pdf`);
  }


  gerarPdfItensEmBaixaPorTipo(itens: Item[], tipo: string): void {
  // Filtra apenas os itens do tipo escolhido que estão em baixa
  const itensFiltrados = itens.filter(
    i => i.tipo_item.nome === tipo && i.quantidade_atual < i.quantidade_minima
  );

  if (itensFiltrados.length === 0) {
    this.snackbar.show(`Não há itens em baixa do tipo "${tipo}".`, 'warning');
    return;
  }

  const doc = this.criarDocumento(); // método que já cria o cabeçalho com empresa e usuário

  const tabela = itensFiltrados.map(item => [
    item.codigo,
    item.nome,
    item.tipo_item.nome,
    item.prateleira_estoque,
    item.quantidade_atual,
    item.quantidade_minima
  ]);

  autoTable(doc, {
    head: [['Código', 'Nome', 'Tipo', 'Prateleira', 'Qtd Atual', 'Qtd Mínima']],
    body: tabela,
    startY: 40,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

  doc.save(`itens_em_baixa_${tipo}_${new Date().toISOString()}.pdf`);
}

  gerarPdfAssinaturaEpi(relatorio: AssinaturaEpiRelatorio): void {
    const doc = new jsPDF();
    const usuario = this.authService.getUsuarioLogadoValue()?.nome || 'USUARIO';
    const dataGeracao = new Date(relatorio.gerado_em);
    const assinaturaData = relatorio.assinado_em ? new Date(relatorio.assinado_em) : null;

    doc.setFontSize(15);
    doc.text('CONTROLE DE ASSINATURAS DE EPI', 14, 16);
    doc.setFontSize(10);
    doc.text(`Solicitante: ${relatorio.solicitante_nome}`, 14, 24);
    doc.text(`Competencia: ${relatorio.competencia_label}`, 14, 30);
    doc.text(`Relatorio: ${relatorio.sequencia_relatorio}`, 14, 36);
    doc.text(`Gerado em: ${dataGeracao.toLocaleDateString('pt-BR')} ${dataGeracao.toLocaleTimeString('pt-BR')}`, 14, 42);
    doc.text(`Gerado por: ${relatorio.gerado_por_nome || usuario}`, 14, 48);

    const tabela = relatorio.itens.map(item => [
      new Date(item.lancamento.data_saida).toLocaleDateString('pt-BR'),
      item.lancamento.numero_bloco_requisicao,
      item.lancamento.nome_item_snapshot,
      item.lancamento.quantidade,
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['Data Saida', 'Bloco/Requisicao', 'Item', 'Quantidade']],
      body: tabela.length ? tabela : [['-', '-', 'Nenhum item encontrado', '-']],
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

}
