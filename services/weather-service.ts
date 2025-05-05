
import axios from 'axios';

interface WeatherData {
  temperature: number;
  condition: string;
  visibility: number;
  alerts?: string[];
}

export class WeatherService {
  private static instance: WeatherService;
  private readonly apiKey: string;

  private constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
  }

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async getWeatherForLocation(lat: number, lon: number): Promise<WeatherData> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );

      return {
        temperature: response.data.main.temp,
        condition: response.data.weather[0].main,
        visibility: response.data.visibility,
        alerts: response.data.alerts,
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }

  async getWeatherAlerts(region: string): Promise<string[]> {
    // Mock implementation - replace with actual API call
    return [
      "Heavy rainfall expected in downtown area",
      "Strong winds along coastal routes",
    ];
  }
}

export const weatherService = WeatherService.getInstance();
