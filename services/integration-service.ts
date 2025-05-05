
import axios from 'axios';

interface IntegrationConfig {
  apiKey: string;
  endpoint: string;
  type: 'fuel' | 'gps' | 'erp' | 'payment';
}

export class IntegrationService {
  private static instance: IntegrationService;
  private integrations: Map<string, IntegrationConfig> = new Map();

  public static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  async registerIntegration(name: string, config: IntegrationConfig): Promise<boolean> {
    try {
      // Validate integration
      await this.testConnection(config);
      this.integrations.set(name, config);
      return true;
    } catch (error) {
      console.error(`Failed to register integration ${name}:`, error);
      return false;
    }
  }

  private async testConnection(config: IntegrationConfig): Promise<void> {
    try {
      await axios.get(config.endpoint, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async syncData(integrationName: string): Promise<any> {
    const config = this.integrations.get(integrationName);
    if (!config) {
      throw new Error(`Integration ${integrationName} not found`);
    }

    try {
      const response = await axios.get(`${config.endpoint}/sync`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Sync failed: ${error.message}`);
    }
  }
}

export const integrationService = IntegrationService.getInstance();
