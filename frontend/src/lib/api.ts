const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const result: ApiResponse<T> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result.data as T;
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  }

  async saveCircleMetadata(
    contractAddress: string,
    name: string,
    description: string,
    isPublic?: boolean,
    circleId?: number
  ) {
    const payload: {
      contractAddress: string;
      name: string;
      description: string;
      isPublic?: boolean;
      circleId?: number;
    } = { contractAddress, name, description };

    if (typeof isPublic === 'boolean') {
      payload.isPublic = isPublic;
    }

    if (typeof circleId === 'number') {
      payload.circleId = circleId;
    }

    return this.request<any>(
      'POST',
      '/api/circles/metadata',
      payload
    );
  }

  async getCircleMetadata(contractAddress: string) {
    return this.request<any>('GET', `/api/circles/${contractAddress}`);
  }

  async listCircles(options: { isPublic?: boolean; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();

    if (typeof options.isPublic === 'boolean') {
      params.set('isPublic', String(options.isPublic));
    }

    if (options.limit) {
      params.set('limit', String(options.limit));
    }

    if (options.offset) {
      params.set('offset', String(options.offset));
    }

    const query = params.toString();
    return this.request<any[]>('GET', `/api/circles${query ? `?${query}` : ''}`);
  }

  async generateInviteCode(contractAddress: string, expiresIn: number = 720) {
    return this.request<any>(
      'POST',
      '/api/invites',
      { contractAddress, expiresIn }
    );
  }

  async resolveInviteCode(shortCode: string) {
    return this.request<any>('GET', `/api/invites/${shortCode}`);
  }

  async recordInviteJoin(shortCode: string, walletAddress: string) {
    return this.request<any>(
      'POST',
      `/api/invites/${shortCode}/joined`,
      { walletAddress }
    );
  }

  async saveUserPreferences(
    walletAddress: string,
    email?: string,
    enablePushNotifications: boolean = true,
    timezoneName: string = 'UTC'
  ) {
    return this.request<any>(
      'POST',
      '/api/users/preferences',
      { walletAddress, email, enablePushNotifications, timezoneName }
    );
  }

  async trackCircle(walletAddress: string, contractAddress: string) {
    return this.request<any>(
      'POST',
      '/api/users/track-circle',
      { walletAddress, contractAddress }
    );
  }

  async getUserCircles(walletAddress: string) {
    return this.request<{ circles: string[]; walletAddress: string; totalCircles: number }>(
      'GET',
      `/api/users/circles/${walletAddress}`
    );
  }

  async getUserPreferences(walletAddress: string) {
    return this.request<any>('GET', `/api/users/${walletAddress}/preferences`);
  }
}

export const api = new ApiClient();
export default api;
