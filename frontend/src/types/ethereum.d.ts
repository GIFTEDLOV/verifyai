interface EthereumProvider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on(event: string, handler: (data: unknown) => void): void;
  removeListener(event: string, handler: (data: unknown) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
