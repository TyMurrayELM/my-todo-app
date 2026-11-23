import { describe, it, expect } from 'vitest';
import { skyFromCode, skyFromText, skyLabel, parsePlace, pickPlace, placeLabel } from './weather';

describe('skyFromCode', () => {
  it('maps weather codes to a sky', () => {
    expect(skyFromCode(0)).toBe('clear');
    expect(skyFromCode(1)).toBe('clear');
    expect(skyFromCode(2)).toBe('partly');
    expect(skyFromCode(3)).toBe('cloudy');
    expect(skyFromCode(45)).toBe('fog');
    expect(skyFromCode(61)).toBe('rain');
    expect(skyFromCode(80)).toBe('rain');
    expect(skyFromCode(73)).toBe('snow');
    expect(skyFromCode(86)).toBe('snow');
    expect(skyFromCode(95)).toBe('storm');
  });
  it('reads a forecast phrase', () => {
    expect(skyFromText('Mostly Sunny')).toBe('clear');
    expect(skyFromText('Mostly Clear')).toBe('clear');
    expect(skyFromText('Partly Sunny')).toBe('partly');
    expect(skyFromText('Partly Cloudy')).toBe('partly');
    expect(skyFromText('Mostly Cloudy')).toBe('cloudy');
    expect(skyFromText('Chance Light Rain')).toBe('rain');
    expect(skyFromText('Slight Chance Showers And Thunderstorms')).toBe('storm');
    expect(skyFromText('Rain And Snow Likely')).toBe('snow');
    expect(skyFromText('Patchy Fog')).toBe('fog');
    expect(skyFromText('')).toBe('clear');
  });
  it('labels a clear sky by time of day', () => {
    expect(skyLabel('clear', false)).toBe('Sunny');
    expect(skyLabel('clear', true)).toBe('Clear');
    expect(skyLabel('snow', true)).toBe('Snow');
  });
});

describe('parsePlace', () => {
  it('splits the name from what narrows it', () => {
    expect(parsePlace('Denver')).toEqual({ name: 'Denver', hints: [] });
    expect(parsePlace('Denver, CO')).toEqual({ name: 'Denver', hints: ['co', 'colorado'] });
    expect(parsePlace(' Portland , Maine ')).toEqual({ name: 'Portland', hints: ['maine'] });
    expect(parsePlace('')).toEqual({ name: '', hints: [] });
  });
});

describe('pickPlace', () => {
  const results = [
    { name: 'Portland', admin1: 'Oregon', country: 'United States', country_code: 'US' },
    { name: 'Portland', admin1: 'Maine', country: 'United States', country_code: 'US' },
    { name: 'Portland', admin1: 'Victoria', country: 'Australia', country_code: 'AU' },
  ];
  it('takes the first result when nothing narrows it', () => {
    expect(pickPlace(results, []).admin1).toBe('Oregon');
  });
  it('uses the state or country after the comma', () => {
    expect(pickPlace(results, parsePlace('Portland, ME').hints).admin1).toBe('Maine');
    expect(pickPlace(results, parsePlace('Portland, Australia').hints).admin1).toBe('Victoria');
  });
  it('falls back to the first result when the hint matches nothing', () => {
    expect(pickPlace(results, ['texas']).admin1).toBe('Oregon');
    expect(pickPlace([], ['texas'])).toBe(null);
    expect(pickPlace(undefined, [])).toBe(null);
  });
  it('labels a place, with the country outside the US', () => {
    expect(placeLabel(results[1])).toBe('Portland, Maine');
    expect(placeLabel(results[2])).toBe('Portland, Victoria, Australia');
  });
});
