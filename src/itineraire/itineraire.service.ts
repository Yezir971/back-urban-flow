import {
  Injectable,
  NotFoundException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface OtpLeg {
  distance?: number;
  legGeometry?: {
    points?: string;
  };
}

interface OtpItinerary {
  duration: number;
  legs: OtpLeg[];
}

interface OtpPlanResponse {
  plan?: {
    itineraries?: OtpItinerary[];
  };
}

@Injectable()
export class ItineraireService {
  private readonly otpUrl: string;

  constructor(configService: ConfigService) {
    this.otpUrl = configService.get<string>('OTP_URL') || 'http://localhost:8080';
  }

  async getWalkRoute(
    start: string,
    end: string,
    mode = 'WALK',
  ): Promise<{ duree: number; distance: number; trace: string }> {
    try {
      const planUrl = `${this.otpUrl.replace(/\/$/, '')}/otp/routers/default/plan`;
      const res = await axios.get<OtpPlanResponse>(planUrl, {
        params: { fromPlace: start, toPlace: end, mode },
        timeout: 5000,
        headers: { Accept: 'application/json' },
      });

      const data = res.data;

      if (
        !data ||
        !data.plan ||
        !data.plan.itineraries ||
        data.plan.itineraries.length === 0
      ) {
        throw new NotFoundException('Aucun itinéraire trouvé');
      }

      const itinerary = data.plan.itineraries[0];
      const distance = itinerary.legs.reduce(
        (sum: number, leg: OtpLeg) => sum + (leg.distance || 0),
        0,
      );
      const trace = itinerary.legs[0]?.legGeometry?.points || '';

      return {
        duree: itinerary.duration,
        distance,
        trace,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new GatewayTimeoutException('Délai de calcul dépassé');
    }
  }
}
