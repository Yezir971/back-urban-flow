import {                                                                                                  
  Injectable,                                                                                             
  NotFoundException,                                                                                      
  GatewayTimeoutException,                                                                                
} from '@nestjs/common';                                                                                  
import { ConfigService } from '@nestjs/config';                                                           
import axios from 'axios';                                                                                
                                                                                                          
interface OtpLeg {                                                                                        
  mode?: string;                                                                                          
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
    const [startLat, startLon] = start.split(',').map((v) => parseFloat(v.trim()));                       
    const [endLat, endLon] = end.split(',').map((v) => parseFloat(v.trim()));                             
                                                                                                          
    // 1. Tenter d'abord l'API GraphQL native de OTP 2.x                                                  
    if (!isNaN(startLat) && !isNaN(startLon) && !isNaN(endLat) && !isNaN(endLon)) {                       
      try {                                                                                               
        let transportModes: Array<{ mode: string }> = [{ mode: 'WALK' }];                                 
        const upperMode = (mode || 'WALK').toUpperCase();                                                 
        if (upperMode.includes('BICYCLE')) {                                                              
          transportModes = [{ mode: 'BICYCLE' }];                                                         
        } else if (                                                                                       
          upperMode.includes('TRANSIT') ||                                                                
          upperMode.includes('BUS') ||                                                                    
          upperMode.includes('SUBWAY') ||                                                                 
          upperMode.includes('TRAM')                                                                      
        ) {                                                                                               
          transportModes = [{ mode: 'TRANSIT' }, { mode: 'WALK' }];                                       
        }                                                                                                 
                                                                                                          
        const graphqlUrl = `${this.otpUrl.replace(/\/$/, '')}/otp/routers/default/index/graphql`;         
        const modesGql = transportModes.map((m) => `{mode: ${m.mode}}`).join(', ');                       
        const gqlBody = {                                                                                 
          query: `query { plan(from: {lat: ${startLat}, lon: ${startLon}}, to: {lat: ${endLat}, lon: ${endLon}}, transportModes: [${modesGql}]) { itineraries { duration legs { mode distance legGeometry { points } } } } }`,                                                                                          
        };                                                                                                
                                                                                                          
        const gqlRes = await axios.post(graphqlUrl, gqlBody, {                                            
          timeout: 5000,                                                                                 
          headers: { 'Content-Type': 'application/json' },                                                
        });                                                                                               
                                                                                                          
        const itineraries: OtpItinerary[] = gqlRes.data?.data?.plan?.itineraries;                         
        if (itineraries && itineraries.length > 0) {                                                      
          const itinerary = itineraries[0];                                                               
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
        }                                                                                                 
      } catch (gqlErr) {                                                                                  
        // En cas d'erreur GraphQL, tentative de repli                                                    
      }                                                                                                   
    }                                                                                                     
                                                                                                          
    // 2. Repli sur l'API REST classique                                                                  
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