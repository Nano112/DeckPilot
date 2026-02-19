export interface DataSourceProvider {
  readonly name: string;
  readonly intervalMs: number;
  fetch(): Promise<unknown>;
}
