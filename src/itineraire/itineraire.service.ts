import {
  Injectable,
  Logger,
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

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    duration: number;
    distance: number;
    geometry: string;
  }>;
}

/**
 * Décode une polyline encodée en tableau de points [lat, lon]
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Encode des points [lat, lon] selon l'algorithme Google Polyline
 */
function encodePolylinePoints(points: [number, number][]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of points) {
    const latVal = Math.round(lat * 1e5);
    const lngVal = Math.round(lng * 1e5);

    const dLat = latVal - prevLat;
    const dLng = lngVal - prevLng;

    prevLat = latVal;
    prevLng = lngVal;

    for (let val of [dLat, dLng]) {
      val = val < 0 ? ~(val << 1) : val << 1;
      while (val >= 0x20) {
        result += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
        val >>= 5;
      }
      result += String.fromCharCode(val + 63);
    }
  }
  return result;
}

@Injectable()
export class ItineraireService {
  private readonly logger = new Logger(ItineraireService.name);
  private readonly otpUrl: string;

  constructor(configService: ConfigService) {
    this.otpUrl = configService.get<string>('OTP_URL') || 'http://localhost:8080';
  }

  async getWalkRoute(
    start: string,
    end: string,
    mode = 'WALK',
  ): Promise<{ duree: number; distance: number; trace: string }> {
    const planUrl = `${this.otpUrl.replace(/\/$/, '')}/otp/routers/default/plan`;
    const otpMode = mode === 'TRANSIT' ? 'TRANSIT,WALK' : mode;

    // 1. Tenter d'interroger le serveur local OpenTripPlanner (OTP)
    try {
      this.logger.log(`Interrogation OTP (${planUrl}) - start: ${start}, end: ${end}, mode: ${otpMode}`);

      const res = await axios.get<OtpPlanResponse>(planUrl, {
        params: { fromPlace: start, toPlace: end, mode: otpMode },
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });

      const data = res.data;

      if (
        data &&
        data.plan &&
        data.plan.itineraries &&
        data.plan.itineraries.length > 0
      ) {
        const itinerary = data.plan.itineraries[0];
        const distance = itinerary.legs.reduce(
          (sum: number, leg: OtpLeg) => sum + (leg.distance || 0),
          0,
        );

        // Combinaison de la géométrie de TOUTES les étapes (legs) pour suivre l'intégralité du réseau routier
        const allPoints: [number, number][] = [];
        for (const leg of itinerary.legs) {
          if (leg.legGeometry?.points) {
            const decoded = decodePolyline(leg.legGeometry.points);
            allPoints.push(...decoded);
          }
        }

        const fullTrace = allPoints.length > 0 
          ? encodePolylinePoints(allPoints) 
          : itinerary.legs[0]?.legGeometry?.points || '';

        return {
          duree: itinerary.duration,
          distance,
          trace: fullTrace,
        };
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Serveur OTP local non disponible (${err.message}). Bascule sur le réseau routier réel OSRM.`);
    }

    // 2. Routage réseau réel sur les voieries via l'API OSRM (Open Source Routing Machine)
    return this.getOsrmRealRoadRoute(start, end, mode);
  }

  private async getOsrmRealRoadRoute(start: string, end: string, mode: string) {
    const [startLat, startLon] = start.split(',').map((v) => parseFloat(v.trim()));
    const [endLat, endLon] = end.split(',').map((v) => parseFloat(v.trim()));

    const sLat = isNaN(startLat) ? 45.7578 : startLat;
    const sLon = isNaN(startLon) ? 4.8322 : startLon;
    const eLat = isNaN(endLat) ? 45.7602 : endLat;
    const eLon = isNaN(endLon) ? 4.8596 : endLon;

    // Profil de voierie OSRM (foot, bike, driving)
    let osrmProfile = 'foot';
    if (mode === 'BICYCLE' || mode === 'Vélos') osrmProfile = 'bike';
    if (mode === 'TRANSIT' || mode === 'CAR') osrmProfile = 'driving';

    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${sLon},${sLat};${eLon},${eLat}?overview=full&geometries=polyline`;

    try {
      this.logger.log(`Interrogation du réseau routier OSRM: ${osrmUrl}`);
      const res = await axios.get<OsrmResponse>(osrmUrl, { timeout: 8000 });
      
      if (res.data && res.data.code === 'Ok' && res.data.routes && res.data.routes.length > 0) {
        const route = res.data.routes[0];
        return {
          duree: Math.round(route.duration),
          distance: Math.round(route.distance),
          trace: route.geometry,
        };
      }
    } catch (err: any) {
      this.logger.error(`Erreur OSRM: ${err.message}`);
    }

    // Tracé direct en secours ultime
    const routePoints: [number, number][] = [
      [sLat, sLon],
      [eLat, eLon],
    ];
    return {
      duree: 600,
      distance: 1200,
      trace: encodePolylinePoints(routePoints),
    };
  }
}
