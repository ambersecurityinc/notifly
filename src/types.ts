export interface NotiflyMessage {
  title?: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'failure';
}

export interface ServiceConfig {
  service: string;
  [key: string]: unknown;
}

export interface ServiceDefinition {
  schemas: string[];
  parseUrl(url: URL): ServiceConfig;
  send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult>;
}

export interface NotiflyResult {
  success: boolean;
  service: string;
  error?: string;
}

export interface NotiflyOptions {
  urls: string[];
}
