import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeocodingService } from './geocoding.service';
import { AddressNotGeocodableException } from './exceptions/address-not-geocodable.exception';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let mockFetch: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://photon.komoot.io'),
          },
        },
      ],
    }).compile();

    service = module.get<GeocodingService>(GeocodingService);
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('geocode', () => {
    it('should throw AddressNotGeocodableException if address is empty', async () => {
      await expect(service.geocode('')).rejects.toThrow(
        AddressNotGeocodableException,
      );
      await expect(service.geocode('   ')).rejects.toThrow(
        AddressNotGeocodableException,
      );
    });

    it('should return {lat, lng} for a valid geocodable address', async () => {
      const mockGeojson = {
        features: [
          {
            geometry: {
              type: 'Point',
              coordinates: [13.438596, 52.519854], // [lng, lat]
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeojson),
      });

      const result = await service.geocode('Berlin Koppenstraße');

      expect(result).toEqual({ lat: 52.519854, lng: 13.438596 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://photon.komoot.io/api?q=Berlin%20Koppenstra%C3%9Fe&limit=1',
      );
    });

    it('should throw AddressNotGeocodableException if address is not found (empty features)', async () => {
      const mockGeojson = {
        features: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeojson),
      });

      await expect(
        service.geocode('some-non-existent-address'),
      ).rejects.toThrow(AddressNotGeocodableException);
    });

    it('should throw AddressNotGeocodableException if Photon API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(service.geocode('Berlin')).rejects.toThrow(
        AddressNotGeocodableException,
      );
    });

    it('should throw AddressNotGeocodableException if fetch fails completely (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.geocode('Berlin')).rejects.toThrow(
        AddressNotGeocodableException,
      );
    });
  });
});
