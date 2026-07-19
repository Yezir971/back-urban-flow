import { UnprocessableEntityException } from '@nestjs/common';

export class AddressNotGeocodableException extends UnprocessableEntityException {
  constructor(address: string) {
    super(`L'adresse "${address}" n'a pas pu être géocodée.`);
  }
}
