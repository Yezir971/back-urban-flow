import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ItineraireService } from './itineraire.service';
import { NotFoundException } from '@nestjs/common';
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
    it('should return real multimodal proposals via GraphQL when available', async () => {
      const mockGqlResponse = {
        data: {
          data: {
            plan: {
              itineraries: [
                {
                  duration: 480,
                  legs: [
                    {
                      mode: 'SUBWAY',
                      distance: 2500,
                      route: { shortName: 'D', longName: 'Métro D' },
                      headsign: 'Gare de Vaise',
                      legGeometry: {
                        points: 'xyz_polyline',
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockGqlResponse);

      const result = await service.getWalkRoute(
        '45.7578,4.8320',
        '45.7606,4.8590',
        'TRANSIT',
      );

      expect(result.duree).toBe(480);
      expect(result.distance).toBe(2500);
      expect(result.trace).toBe('xyz_polyline');
      expect(result.proposals).toBeDefined();
      expect(result.proposals.length).toBeGreaterThan(0);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should fallback to REST API if GraphQL fails and return valid route', async () => {
      const mockOtpResponse = {
        data: {
          plan: {
            itineraries: [
              {
                duration: 600,
                legs: [
                  {
                    distance: 500,
                    mode: 'SUBWAY',
                    route: { shortName: 'A' },
                    legGeometry: {
                      points: 'abc_polyline',
                    },
                  },
                  {
                    distance: 300,
                    mode: 'WALK',
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

      mockedAxios.post.mockRejectedValue(new Error('GraphQL unavailable'));
      mockedAxios.get.mockResolvedValue(mockOtpResponse);

      const result = await service.getWalkRoute(
        '48.8566,2.3522',
        '48.8606,2.3376',
      );

      expect(result.duree).toBe(600);
      expect(result.distance).toBe(800);
      expect(result.trace).toBe('abc_polyline');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8080/otp/routers/default/plan',
        expect.objectContaining({
          params: expect.objectContaining({
            fromPlace: '48.8566,2.3522',
            toPlace: '48.8606,2.3376',
          }),
          timeout: 12000,
          headers: { Accept: 'application/json' },
        }),
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

      mockedAxios.post.mockRejectedValue(new Error('GraphQL unavailable'));
      mockedAxios.get.mockResolvedValue(mockOtpResponse);

      await expect(
        service.getWalkRoute('48.8566,2.3522', '48.8606,2.3376'),
      ).rejects.toThrow(new NotFoundException('Aucun itinéraire trouvé pour ce trajet'));
    });

    it('should throw NotFoundException if network requests fail', async () => {
      mockedAxios.post.mockRejectedValue(new Error('GraphQL unavailable'));
      mockedAxios.get.mockRejectedValue(new Error('Network Timeout'));

      await expect(
        service.getWalkRoute('48.8566,2.3522', '48.8606,2.3376'),
      ).rejects.toThrow(new NotFoundException('Aucun itinéraire trouvé pour ce trajet'));
    });
  });
});
