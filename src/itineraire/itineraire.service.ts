import {
  Injectable,
  NotFoundException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OtpLeg {
  mode: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  distance?: number;
  realTime?: boolean;
  departureDelay?: number;
  arrivalDelay?: number;
  from?: {
    name?: string;
    lat?: number;
    lon?: number;
  };
  to?: {
    name?: string;
    lat?: number;
    lon?: number;
  };
  route?: {
    shortName?: string;
    longName?: string;
    mode?: string;
  };
  headsign?: string;
  legGeometry?: {
    points?: string;
  };
}

export interface OtpItinerary {
  startTime?: number;
  endTime?: number;
  duration: number;
  legs: OtpLeg[];
}

export interface ItineraryLegFormatted {
  mode: string;
  title: string;
  instruction: string;
  durationMinutes: number;
  distanceMeters: number;
  line?: string;
  headsign?: string;
  stopsCount?: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  realTime?: boolean;
  delayMinutes?: number;
  departureTimeFormatted?: string;
  departureStatus?: 'ON_TIME' | 'DELAYED' | 'EARLY';
  legGeometry?: {
    points?: string;
  };
}

export interface ItineraryProposal {
  id: string;
  type: 'TRANSIT' | 'WALK' | 'BICYCLE' | 'SCOOTER' | 'CAR';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: string;
  durationMinutes: number;
  distanceMeters: number;
  co2SavedKg: number;
  priceApprox?: string;
  tag?: string;
  leavesInMinutes?: number;
  realTime?: boolean;
  delayMinutes?: number;
  departureStatus?: 'ON_TIME' | 'DELAYED' | 'EARLY';
  arrivalTime?: string;
  trace: string;
  legs: ItineraryLegFormatted[];
}

export interface ItineraryResponse {
  duree: number;
  distance: number;
  trace: string;
  legs?: OtpLeg[];
  proposals: ItineraryProposal[];
}

@Injectable()
export class ItineraireService {
  private readonly otpUrl: string;

  constructor(configService: ConfigService) {
    this.otpUrl = configService.get<string>('OTP_URL') || 'http://localhost:8080';
  }

  /**
   * Calcule les propositions d'itinéraires multimodaux réels en direct depuis OpenTripPlanner
   * (Transports TCL, Marche, Vélo, Voiture)
   */
  async getWalkRoute(
    start: string,
    end: string,
    mode = 'TRANSIT',
  ): Promise<ItineraryResponse> {
    const [startLat, startLon] = start.split(',').map((v) => parseFloat(v.trim()));
    const [endLat, endLon] = end.split(',').map((v) => parseFloat(v.trim()));

    if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
      throw new NotFoundException('Coordonnées invalides');
    }

    try {
      const upperMode = (mode || 'TRANSIT').toUpperCase();
      let transitModeParam = 'TRANSIT,WALK';
      if (upperMode.includes('BUS')) {
        transitModeParam = 'BUS,WALK';
      }

      // 1. Calcul parallèle des 4 modes réels auprès d'OTP (Transports TCL, Marche, Vélo, Voiture)
      const [transitItinerary, walkItinerary, bikeItinerary, carItinerary] = await Promise.all([
        this.getOtpRoute(startLat, startLon, endLat, endLon, transitModeParam),
        this.getOtpRoute(startLat, startLon, endLat, endLon, 'WALK'),
        this.getOtpRoute(startLat, startLon, endLat, endLon, 'BICYCLE'),
        this.getOtpRoute(startLat, startLon, endLat, endLon, 'CAR'),
      ]);

      const proposals: ItineraryProposal[] = [];

      // Distance de référence voiture (trajet routier pour comparaison d'émissions)
      const carReferenceMeters =
        carItinerary?.legs?.reduce((acc, l) => acc + (l.distance || 0), 0) || 0;

      // A. PROPOSITION TRANSPORTS EN COMMUN (TCL Lyon : Métro, Tram, Bus)
      if (transitItinerary && transitItinerary.legs.length > 0) {
        const totalDurationMins = Math.max(1, Math.round(transitItinerary.duration / 60));
        const totalDistanceMeters = transitItinerary.legs.reduce((acc, l) => acc + (l.distance || 0), 0);
        const co2SavedKg = this.calculateCo2Savings(transitItinerary.legs, carReferenceMeters);

        const transitLegs = transitItinerary.legs.filter((l) =>
          ['SUBWAY', 'TRAM', 'BUS', 'TRANSIT', 'RAIL'].includes(l.mode?.toUpperCase()),
        );
        const primaryTransitLeg = transitLegs[0];
        const lineBadge = primaryTransitLeg?.route?.shortName || primaryTransitLeg?.route?.longName || (primaryTransitLeg?.mode === 'SUBWAY' ? 'Métro' : (primaryTransitLeg?.mode === 'BUS' ? 'Bus' : 'TCL'));
        const direction = primaryTransitLeg?.headsign
          ? `Direction ${primaryTransitLeg.headsign}`
          : (primaryTransitLeg?.to?.name ? `Vers ${primaryTransitLeg.to.name}` : 'Réseau TCL');

        const delaySeconds = primaryTransitLeg?.departureDelay || 0;
        const delayMinutes = Math.round(delaySeconds / 60);

        let leavesInMins = 3;
        if (primaryTransitLeg?.startTime) {
          const diffMs = primaryTransitLeg.startTime - Date.now();
          if (diffMs > 0) {
            leavesInMins = Math.max(1, Math.round(diffMs / 60000));
          }
        }

        const formattedLegs: ItineraryLegFormatted[] = transitItinerary.legs.map((leg, idx) => {
          const legDurMins = Math.max(1, Math.round((leg.duration || 60) / 60));
          const isWalk = leg.mode?.toUpperCase() === 'WALK';
          const legDelayMins = Math.round((leg.departureDelay || 0) / 60);

          let modeName = 'Ligne';
          if (leg.mode === 'SUBWAY') modeName = 'Métro';
          else if (leg.mode === 'TRAM') modeName = 'Tramway';
          else if (leg.mode === 'BUS') modeName = 'Bus';

          const legLine = leg.route?.shortName || leg.route?.longName || '';

          return {
            mode: leg.mode,
            title: isWalk ? `Marche (${legDurMins} min)` : (legLine ? `${modeName} ${legLine}` : modeName),
            instruction: leg.from?.name && leg.to?.name ? `Depuis ${leg.from.name} vers ${leg.to.name}` : (leg.headsign ? `Direction ${leg.headsign}` : (idx === 0 ? 'Vers la station' : 'Vers votre destination')),
            durationMinutes: legDurMins,
            distanceMeters: Math.round(leg.distance || 0),
            line: leg.route?.shortName,
            headsign: leg.headsign,
            stopsCount: isWalk ? undefined : 4,
            status: idx === 0 ? 'COMPLETED' : (idx === 1 ? 'IN_PROGRESS' : 'UPCOMING'),
            realTime: leg.realTime ?? true,
            delayMinutes: legDelayMins,
            departureStatus: legDelayMins > 1 ? 'DELAYED' : (legDelayMins < -1 ? 'EARLY' : 'ON_TIME'),
            departureTimeFormatted: this.formatTimeFromEpoch(leg.startTime),
            legGeometry: leg.legGeometry,
          };
        });

        let transitTitle = 'Transports en commun';
        if (primaryTransitLeg) {
          const mName = primaryTransitLeg.mode === 'SUBWAY' ? 'Métro' : (primaryTransitLeg.mode === 'TRAM' ? 'Tramway' : 'Bus');
          transitTitle = primaryTransitLeg.route?.shortName ? `${mName} Ligne ${primaryTransitLeg.route.shortName}` : mName;
        }

        proposals.push({
          id: 'transit-otp',
          type: 'TRANSIT',
          title: transitTitle,
          subtitle: `${direction} • Part dans ${leavesInMins} min`,
          badge: lineBadge,
          badgeColor: '#155dfc',
          durationMinutes: totalDurationMins,
          distanceMeters: totalDistanceMeters,
          co2SavedKg,
          leavesInMinutes: leavesInMins,
          realTime: primaryTransitLeg?.realTime ?? true,
          delayMinutes,
          departureStatus: delayMinutes > 1 ? 'DELAYED' : 'ON_TIME',
          arrivalTime: this.formatArrivalTime(totalDurationMins),
          trace: this.extractFullTrace(transitItinerary),
          legs: formattedLegs,
        });
      }

      // B. PROPOSITION VÉLO / VÉLO'V (OpenStreetMap Cyclable)
      if (bikeItinerary && bikeItinerary.legs.length > 0) {
        const totalDurationMins = Math.max(1, Math.round(bikeItinerary.duration / 60));
        const totalDistanceMeters = bikeItinerary.legs.reduce((acc, l) => acc + (l.distance || 0), 0);
        const distanceKm = (totalDistanceMeters / 1000).toFixed(1);
        const co2SavedKg = this.calculateCo2Savings(bikeItinerary.legs, carReferenceMeters);

        const formattedLegs: ItineraryLegFormatted[] = bikeItinerary.legs.map((leg) => {
          const legDurMins = Math.max(1, Math.round((leg.duration || bikeItinerary.duration) / 60));
          return {
            mode: 'BICYCLE',
            title: `Trajet Vélo (${legDurMins} min)`,
            instruction: `Itinéraire cyclable via Voies Lyonnaises (${distanceKm} km)`,
            durationMinutes: legDurMins,
            distanceMeters: Math.round(leg.distance || totalDistanceMeters),
            status: 'IN_PROGRESS',
            departureStatus: 'ON_TIME',
            departureTimeFormatted: this.formatTimeFromEpoch(leg.startTime),
            legGeometry: leg.legGeometry,
          };
        });

        proposals.push({
          id: 'bike-otp',
          type: 'SCOOTER',
          title: 'Vélo / Vélo\'v',
          subtitle: `${distanceKm} km • Voies Lyonnaises`,
          badge: 'BIKE',
          badgeColor: '#10b981',
          durationMinutes: totalDurationMins,
          distanceMeters: totalDistanceMeters,
          co2SavedKg,
          priceApprox: 'Vélo\'v',
          departureStatus: 'ON_TIME',
          arrivalTime: this.formatArrivalTime(totalDurationMins),
          trace: this.extractFullTrace(bikeItinerary),
          legs: formattedLegs,
        });
      }

      // C. PROPOSITION VOITURE (OpenStreetMap Réseau Routier)
      if (carItinerary && carItinerary.legs.length > 0) {
        const totalDurationMins = Math.max(1, Math.round(carItinerary.duration / 60));
        const totalDistanceMeters = carItinerary.legs.reduce((acc, l) => acc + (l.distance || 0), 0);
        const distanceKm = (totalDistanceMeters / 1000).toFixed(1);
        const fuelCost = (parseFloat(distanceKm) * 0.15).toFixed(2);

        const formattedLegs: ItineraryLegFormatted[] = carItinerary.legs.map((leg) => {
          const legDurMins = Math.max(1, Math.round((leg.duration || carItinerary.duration) / 60));
          return {
            mode: 'CAR',
            title: `Trajet en voiture (${legDurMins} min)`,
            instruction: `Via réseau routier (${distanceKm} km)`,
            durationMinutes: legDurMins,
            distanceMeters: Math.round(leg.distance || totalDistanceMeters),
            status: 'IN_PROGRESS',
            departureStatus: 'ON_TIME',
            departureTimeFormatted: this.formatTimeFromEpoch(leg.startTime),
            legGeometry: leg.legGeometry,
          };
        });

        proposals.push({
          id: 'car-otp',
          type: 'CAR',
          title: 'Voiture',
          subtitle: `${distanceKm} km • Réseau routier`,
          badge: 'CAR',
          badgeColor: '#64748b',
          durationMinutes: totalDurationMins,
          distanceMeters: totalDistanceMeters,
          co2SavedKg: 0.0,
          priceApprox: `Carburant ~${fuelCost}€`,
          departureStatus: 'ON_TIME',
          arrivalTime: this.formatArrivalTime(totalDurationMins),
          trace: this.extractFullTrace(carItinerary),
          legs: formattedLegs,
        });
      }

      // D. PROPOSITION MARCHE À PIED (OpenStreetMap Piéton)
      if (walkItinerary && walkItinerary.legs.length > 0) {
        const totalDurationMins = Math.max(1, Math.round(walkItinerary.duration / 60));
        const totalDistanceMeters = walkItinerary.legs.reduce((acc, l) => acc + (l.distance || 0), 0);
        const distanceKm = (totalDistanceMeters / 1000).toFixed(1);
        const co2SavedKg = this.calculateCo2Savings(walkItinerary.legs, carReferenceMeters);

        const formattedLegs: ItineraryLegFormatted[] = walkItinerary.legs.map((leg) => {
          const legDurMins = Math.max(1, Math.round((leg.duration || walkItinerary.duration) / 60));
          return {
            mode: 'WALK',
            title: `Marche (${legDurMins} min)`,
            instruction: `Itinéraire piéton direct (${distanceKm} km)`,
            durationMinutes: legDurMins,
            distanceMeters: Math.round(leg.distance || totalDistanceMeters),
            status: 'IN_PROGRESS',
            departureStatus: 'ON_TIME',
            departureTimeFormatted: this.formatTimeFromEpoch(leg.startTime),
            legGeometry: leg.legGeometry,
          };
        });

        proposals.push({
          id: 'walk-otp',
          type: 'WALK',
          title: 'Marche à pied',
          subtitle: `${distanceKm} km • Trajet santé`,
          badge: 'WALK',
          badgeColor: '#10b981',
          durationMinutes: totalDurationMins,
          distanceMeters: totalDistanceMeters,
          co2SavedKg,
          tag: 'ECO-HERO',
          priceApprox: 'Gratuit',
          departureStatus: 'ON_TIME',
          arrivalTime: this.formatArrivalTime(totalDurationMins),
          trace: this.extractFullTrace(walkItinerary),
          legs: formattedLegs,
        });
      }

      if (proposals.length === 0) {
        throw new NotFoundException('Aucun itinéraire trouvé pour ce trajet');
      }

      // Ordonne selon le filtre sélectionné par l'utilisateur
      if (upperMode.includes('CAR')) {
        const carIdx = proposals.findIndex((p) => p.type === 'CAR');
        if (carIdx > 0) {
          const [carProp] = proposals.splice(carIdx, 1);
          proposals.unshift(carProp);
        }
      } else if (upperMode.includes('BUS') || upperMode.includes('TRANSIT') || upperMode.includes('TRAIN')) {
        const transitIdx = proposals.findIndex((p) => p.type === 'TRANSIT');
        if (transitIdx > 0) {
          const [transitProp] = proposals.splice(transitIdx, 1);
          proposals.unshift(transitProp);
        }
      } else if (upperMode.includes('BICYCLE')) {
        const bikeIdx = proposals.findIndex((p) => p.type === 'SCOOTER' || p.type === 'BICYCLE');
        if (bikeIdx > 0) {
          const [bikeProp] = proposals.splice(bikeIdx, 1);
          proposals.unshift(bikeProp);
        }
      } else if (upperMode.includes('WALK')) {
        const walkIdx = proposals.findIndex((p) => p.type === 'WALK');
        if (walkIdx > 0) {
          const [walkProp] = proposals.splice(walkIdx, 1);
          proposals.unshift(walkProp);
        }
      }

      const selected = proposals[0];

      return {
        duree: selected.durationMinutes * 60,
        distance: selected.distanceMeters,
        trace: selected.trace,
        legs: transitItinerary?.legs || bikeItinerary?.legs || carItinerary?.legs || walkItinerary?.legs,
        proposals,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new GatewayTimeoutException('Délai de calcul dépassé');
    }
  }

  /**
   * Interroge OTP via GraphQL avec syntaxe standard OTP 2.x
   */
  private async getOtpRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    mode: string,
  ): Promise<OtpItinerary | null> {
    const isTransitMode = mode.includes('TRANSIT') || mode.includes('BUS') || mode.includes('SUBWAY');

    // 1. Requête GraphQL native OTP 2.x
    try {
      const graphqlUrl = `${this.otpUrl.replace(/\/$/, '')}/otp/routers/default/index/graphql`;
      let modesGql = '{mode: WALK}';
      if (mode.includes('BICYCLE')) {
        modesGql = '{mode: BICYCLE}';
      } else if (mode.includes('CAR')) {
        modesGql = '{mode: CAR}';
      } else if (mode.includes('BUS')) {
        modesGql = '{mode: BUS}, {mode: WALK}';
      } else if (mode.includes('TRANSIT')) {
        modesGql = '{mode: TRANSIT}, {mode: WALK}';
      }

      const gqlBody = {
        query: `query {
          plan(
            from: {lat: ${fromLat}, lon: ${fromLon}}
            to: {lat: ${toLat}, lon: ${toLon}}
            transportModes: [${modesGql}]
          ) {
            itineraries {
              startTime
              endTime
              duration
              legs {
                mode
                startTime
                endTime
                duration
                distance
                realTime
                departureDelay
                arrivalDelay
                from { name }
                to { name }
                route { shortName longName }
                headsign
                legGeometry { points }
              }
            }
          }
        }`,
      };

      const res = await axios.post(graphqlUrl, gqlBody, {
        timeout: 12000,
        headers: { 'Content-Type': 'application/json' },
      });

      const itineraries: OtpItinerary[] = res.data?.data?.plan?.itineraries;
      if (itineraries && itineraries.length > 0) {
        if (isTransitMode) {
          const transitItin = itineraries.find((it) =>
            it.legs.some((l) =>
              ['SUBWAY', 'TRAM', 'BUS', 'TRANSIT', 'RAIL'].includes(l.mode?.toUpperCase()),
            ),
          );
          if (transitItin) return transitItin;
        }
        return itineraries[0];
      }
    } catch {
      // Échec GraphQL
    }

    // 2. Repli REST si actif
    try {
      const planUrl = `${this.otpUrl.replace(/\/$/, '')}/otp/routers/default/plan`;
      const res = await axios.get(planUrl, {
        params: {
          fromPlace: `${fromLat},${fromLon}`,
          toPlace: `${toLat},${toLon}`,
          mode,
        },
        timeout: 12000,
        headers: { Accept: 'application/json' },
      });

      const itineraries: OtpItinerary[] = res.data?.plan?.itineraries;
      if (itineraries && itineraries.length > 0) {
        if (isTransitMode) {
          const transitItin = itineraries.find((it) =>
            it.legs.some((l) =>
              ['SUBWAY', 'TRAM', 'BUS', 'TRANSIT', 'RAIL'].includes(l.mode?.toUpperCase()),
            ),
          );
          if (transitItin) return transitItin;
        }
        return itineraries[0];
      }
    } catch {
      // Aucun résultat
    }

    return null;
  }

  private extractFullTrace(itinerary: OtpItinerary): string {
    const pointsList = itinerary.legs
      .map((l) => l.legGeometry?.points)
      .filter((p): p is string => Boolean(p) && p.length > 0);

    return pointsList.length > 0 ? pointsList[0] : '';
  }

  private formatArrivalTime(durationMinutes: number): string {
    const now = new Date();
    const arrival = new Date(now.getTime() + durationMinutes * 60000);
    const h = arrival.getHours().toString().padStart(2, '0');
    const m = arrival.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private formatTimeFromEpoch(epochMs?: number): string | undefined {
    if (!epochMs || epochMs <= 0) return undefined;
    const d = new Date(epochMs);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Facteurs d'émission officiels ADEME / Base Carbone & Impact CO2 (g CO2e / passager.km)
   */
  private readonly EMISSION_FACTORS_G_PER_KM: Record<string, number> = {
    CAR: 218, // Voiture thermique moyenne solo (référence routière)
    BUS: 110, // Bus urbain thermique/hybride
    TRAM: 3.0, // Tramway électrique
    SUBWAY: 2.5, // Métro électrique
    METRO: 2.5,
    RAIL: 4.5, // Train / RER
    TRANSIT: 60, // Moyenne globale transit si non-spécifié
    BICYCLE: 0, // Vélo musculaire
    SCOOTER: 0, // Trottinette
    WALK: 0, // Marche à pied
  };

  /**
   * Calcule le CO2 économisé par rapport à la voiture thermique de référence (en kg avec 2 décimales)
   * CO2 économisé = CO2_voiture (Distance_ref * 218g/km) - CO2_émis_mode (somme des legs * facteur_mode)
   */
  private calculateCo2Savings(
    legs: OtpLeg[],
    carReferenceMeters?: number,
  ): number {
    const totalDistanceMeters = legs.reduce(
      (acc, l) => acc + (l.distance || 0),
      0,
    );
    const refDistanceKm =
      (carReferenceMeters && carReferenceMeters > 0
        ? carReferenceMeters
        : totalDistanceMeters) / 1000;
    const carEmissionG =
      refDistanceKm * (this.EMISSION_FACTORS_G_PER_KM.CAR || 218);

    let modeEmissionG = 0;
    for (const leg of legs) {
      const legKm = (leg.distance || 0) / 1000;
      const upperMode = (leg.mode || 'WALK').toUpperCase();
      const factor = this.EMISSION_FACTORS_G_PER_KM[upperMode] ?? 0;
      modeEmissionG += legKm * factor;
    }

    const savedG = Math.max(0, carEmissionG - modeEmissionG);
    return parseFloat((savedG / 1000).toFixed(2));
  }
}