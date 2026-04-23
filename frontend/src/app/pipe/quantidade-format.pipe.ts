import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'quantidadeFormat',
  standalone: true
})
export class QuantidadeFormatPipe implements PipeTransform {

transform(valor: number | string, unidade: string): string {
  if (valor === null || valor === undefined) return '';
  if (!unidade) return valor.toString();

  const numero = Number(valor); // converte string para número
  if (isNaN(numero)) return valor.toString(); // se não for número, retorna como está

  // unidades que aceitam casas decimais'
  const unidadesComDecimais = ['kg', 'g', 'l', 'ml', 'm', 'cm'];

  if (unidadesComDecimais.includes(unidade)) {
    return numero.toFixed(2).replace('.', ','); // formata com vírgula
  }

  return Math.round(numero).toString(); // arredonda para inteiro
}
}
