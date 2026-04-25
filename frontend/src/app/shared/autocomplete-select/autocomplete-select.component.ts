import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-autocomplete-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete-select.component.html',
  styleUrl: './autocomplete-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteSelectComponent),
      multi: true
    }
  ]
})
export class AutocompleteSelectComponent implements ControlValueAccessor {
  @Input() options: any[] = [];
  @Input() placeholder = 'Buscar...';
  @Input() emptyText = 'Nenhum resultado encontrado';
  @Input() disabledIds: Array<number | string> = [];
  @Input() maxResults = 20;
  @Input() maxLength: number | null = null;
  @Input() inputMode = 'text';
  @Input() freeText = false;
  @Input() onlyNumbers = false;
  @Input() showEmptyText = false;
  @Input() labelWith: (option: any) => string = option => typeof option === 'string' ? option : option?.nome ?? '';
  @Input() valueWith: (option: any) => number | string | null = option => typeof option === 'string' ? option : option?.id ?? null;
  @Input() secondaryWith: (option: any) => string = () => '';
  @Output() selected = new EventEmitter<any>();

  value: number | string | null = null;
  searchText = '';
  isOpen = false;
  isDisabled = false;
  highlightedIndex = 0;

  private onChange: (value: number | string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  get filteredOptions(): any[] {
    const query = this.normalize(this.searchText);
    const disabled = new Set(this.disabledIds.map(id => String(id)));

    return this.options
      .filter(option => !disabled.has(String(this.valueWith(option))))
      .map(option => ({
        option,
        score: this.getScore(option, query)
      }))
      .filter(result => !query || result.score > 0)
      .sort((a, b) => b.score - a.score || this.labelWith(a.option).localeCompare(this.labelWith(b.option)))
      .slice(0, this.maxResults)
      .map(result => result.option);
  }

  writeValue(value: number | string | null): void {
    this.value = value;
    this.syncSearchText();
  }

  registerOnChange(fn: (value: number | string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onInputChange() {
    this.isOpen = true;
    this.highlightedIndex = 0;

    if (this.freeText) {
      this.value = this.searchText;
      this.onChange(this.searchText);
      return;
    }

    const selectedOption = this.getSelectedOption();
    if (selectedOption && this.searchText !== this.labelWith(selectedOption)) {
      this.setValue(null);
    }
  }

  open() {
    if (this.isDisabled) {
      return;
    }
    this.isOpen = true;
    this.highlightedIndex = 0;
  }

  selectOption(option: any) {
    this.value = this.valueWith(option);
    this.searchText = this.labelWith(option);
    this.isOpen = false;
    this.onChange(this.value);
    this.onTouched();
    this.selected.emit(option);
  }

  clear() {
    this.searchText = '';
    this.setValue(null);
    this.open();
  }

  onBlur() {
    window.setTimeout(() => {
      if (!this.elementRef.nativeElement.contains(document.activeElement)) {
        this.isOpen = false;
        this.onTouched();
        this.syncSearchText();
      }
    }, 120);
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.isOpen && ['ArrowDown', 'Enter'].includes(event.key)) {
      this.open();
      event.preventDefault();
      return;
    }

    const options = this.filteredOptions;

    if (event.key === 'ArrowDown') {
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, Math.max(options.length - 1, 0));
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowUp') {
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && this.isOpen && options[this.highlightedIndex]) {
      this.selectOption(options[this.highlightedIndex]);
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this.isOpen = false;
      this.syncSearchText();
      event.preventDefault();
    }
  }

  onKeypress(event: KeyboardEvent) {
    if (!this.onlyNumbers) {
      return;
    }

    const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab'];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.syncSearchText();
    }
  }

  private setValue(value: number | string | null) {
    this.value = value;
    this.onChange(value);
    this.selected.emit(this.getSelectedOption());
  }

  private syncSearchText() {
    const selectedOption = this.getSelectedOption();
    this.searchText = selectedOption ? this.labelWith(selectedOption) : (this.freeText && this.value ? String(this.value) : '');
  }

  private getSelectedOption() {
    return this.options.find(option => String(this.valueWith(option)) === String(this.value));
  }

  private getScore(option: any, query: string): number {
    if (!query) {
      return 1;
    }

    const label = this.normalize(this.labelWith(option));
    const secondary = this.normalize(this.secondaryWith(option));
    const fullText = `${label} ${secondary}`.trim();

    if (label === query) {
      return 100;
    }
    if (label.startsWith(query)) {
      return 80;
    }
    if (label.includes(query)) {
      return 60;
    }
    if (secondary.includes(query)) {
      return 40;
    }

    return query
      .split(' ')
      .filter(term => fullText.includes(term))
      .length * 10;
  }

  private normalize(value: string): string {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
