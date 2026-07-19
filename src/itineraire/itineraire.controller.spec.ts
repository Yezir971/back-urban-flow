import { Test, TestingModule } from '@nestjs/testing';
import { ItineraireController } from './itineraire.controller';
import { ItineraireService } from './itineraire.service';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { BadRequestException } from '@nestjs/common';

describe('ItineraireController', () => {
  let controller: ItineraireController;
  let service: ItineraireService;

  beforeEach(async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItineraireController],
      providers: [
        {
          provide: ItineraireService,
          useValue: {
            getWalkRoute: jest.fn().mockResolvedValue({
              duree: 600,
              distance: 800,
              trace: 'abc_polyline',
            }),
          },
        },
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabaseClient,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ItineraireController>(ItineraireController);
    service = module.get<ItineraireService>(ItineraireService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRoute', () => {
    it('should throw BadRequestException if start is missing', async () => {
      await expect(controller.getRoute('', '48.8606,2.3376')).rejects.toThrow(
        new BadRequestException('Paramètres start et end requis'),
      );
    });

    it('should throw BadRequestException if end is missing', async () => {
      await expect(controller.getRoute('48.8566,2.3522', '')).rejects.toThrow(
        new BadRequestException('Paramètres start et end requis'),
      );
    });

    it('should call service.getWalkRoute with query parameters', async () => {
      const result = await controller.getRoute(
        '48.8566,2.3522',
        '48.8606,2.3376',
        'WALK',
      );

      expect(result).toEqual({
        duree: 600,
        distance: 800,
        trace: 'abc_polyline',
      });
      expect(service.getWalkRoute).toHaveBeenCalledWith(
        '48.8566,2.3522',
        '48.8606,2.3376',
        'WALK',
      );
    });
  });
});
