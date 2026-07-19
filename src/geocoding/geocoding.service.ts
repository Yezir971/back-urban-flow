import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressNotGeocodableException } from './exceptions/address-not-geocodable.exception';

@Injectable()
export class GeocodingService {
  private readonly apiUrl: string;

  constructor(configService: ConfigService) {
    this.apiUrl =
      configService.get<string>('PHOTON_API_URL') || 'https://photon.komoot.io';
  }

  async geocode(address: string): Promise<{ lat: number; lng: number }> {
    if (!address || address.trim() === '') {
      throw new AddressNotGeocodableException(address);
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/api?q=${encodeURIComponent(address)}&limit=1`,
      );

      if (!response.ok) {
        throw new Error(`API Photon retourné avec le statut ${response.status}`);
      }

      const data = (await response.json()) as {
        features: Array<{
          geometry: {
            coordinates: [number, number];
          };
        }>;
      };

      if (!data.features || data.features.length === 0) {
        throw new AddressNotGeocodableException(address);
      }

      const [lng, lat] = data.features[0].geometry.coordinates;
      return { lat, lng };
    } catch (error) {
      if (error instanceof AddressNotGeocodableException) {
        throw error;
      }
      throw new AddressNotGeocodableException(address);
    }
  }
}
