'use strict';

import { isValidLevel } from './cpm.js';
import { isValidIv, type Iv, type Level, type Species } from './types.js';

export function assertIv(iv: Iv): void {
  if (!isValidIv(iv)) throw new RangeError('IV must contain integers from 0 to 15');
}

export function assertLevel(level: Level): void {
  if (!isValidLevel(level)) throw new RangeError('level must be from 1 to 51 in half steps');
}

export function assertSpecies(species: Species): void {
  if (!Number.isInteger(species.id) || species.id <= 0 ||
      ![species.baseAtk, species.baseDef, species.baseSta].every(
        (value) => Number.isInteger(value) && value > 0,
      )) throw new RangeError('invalid species stats');
}
