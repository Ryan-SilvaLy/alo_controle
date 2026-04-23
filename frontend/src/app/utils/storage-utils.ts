export function setInSessionStorage<T>(key: string, value: T | null): void {
    /**
     * Salva um valor genérico no sessionStorage, serializando-o para JSON.
     * Se o valor for null ou undefined, remove o item da storage.
     * 
     * @param key - A chave usada para armazenar o valor no sessionStorage.
     * @param value - O valor genérico a ser armazenado. Pode ser null para remover.
     */

  if (value !== null && value !== undefined) {
    sessionStorage.setItem(key, JSON.stringify(value));
  } else {
    sessionStorage.removeItem(key);
  }
}

export function getFromSessionStorage<T>(key: string): T | null {
    /**
     * Recupera um valor genérico do sessionStorage desserializando-o do JSON.
     * Retorna null se o item não existir na storage.
     * 
     * @param key - A chave usada para buscar o valor no sessionStorage.
     * @returns O valor desserializado do sessionStorage ou null caso não exista.
     */

  const raw = sessionStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : null;
}
