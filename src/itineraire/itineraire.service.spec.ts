import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ItineraireService } from './itineraire.service';
import { NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ItineraireService', () => {
  let service: ItineraireService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItineraireService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:8080'),
          },
        },
      ],
    }).compile();

    service = module.get<ItineraireService>(ItineraireService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWalkRoute', () => {
    it('should return { duree, distance, trace } for a valid route response', async () => {
      const mockOtpResponse = {
        data: {
          plan: {
            itineraries: [
              {
                duration: 600,
                legs: [
                  {
                    distance: 500,
                    legGeometry: {
                      points: 'abc_polyline',
                    },
                  },
                  {
                    distance: 300,
                    legGeometry: {
                      points: 'def_polyline',
                    },
                  },
                ],
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockOtpResponse);

      const result = await service.getWalkRoute(
        '48.8566,2.3522',
        '48.8606,2.3376',
      );

      expect(result).toEqual({
        duree: 600,
        distance: 800,
        trace: 'abc_polyline',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8080/otp/routers/default/plan',
        {
          params: {
            fromPlace: '48.8566,2.3522',
            toPlace: '48.8606,2.3376',
            mode: 'WALK',
          },
          timeout: 5000,
          headers: { Accept: 'application/json' },
        },
      );
    });

    it('should throw NotFoundException if no itineraries are found', async () => {
      const mockOtpResponse = {
        data: {
          plan: {
            itineraries: [],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockOtpResponse);

      await expect(
        service.getWalkRoute('48.8566,2.3522', '48.8606,2.3376'),
      ).rejects.toThrow(new NotFoundException('Aucun itinéraire trouvé'));
    });

    it('should throw GatewayTimeoutException on Axios error or timeout', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        service.getWalkRoute('48.8566,2.3522', '48.8606,2.3376'),
      ).rejects.toThrow(new GatewayTimeoutException('Délai de calcul dépassé'));
    });
  });
});
