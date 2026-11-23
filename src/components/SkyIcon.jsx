// The current sky as a small line icon: gray, with the sun in amber. Same
// drawings as the game cards on odds.day, plus a thunderstorm.
const SUN_RAYS =
  'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4';
const MOON = 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z';
const CLOUD = 'M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.2 8.1 3.5 3.5 0 0 1 17 15';
const BIG_CLOUD = 'M7 19a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.4 1.4A3.8 3.8 0 0 1 17.6 19z';
const SMALL_CLOUD = 'M9 20a3.5 3.5 0 0 1-.3-7 5 5 0 0 1 9.6-.9A3.4 3.4 0 0 1 18 20z';

// `sun` = how many of the day paths (from the front) are the sun, drawn amber
const SKY_PATHS = {
  clear: { day: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', SUN_RAYS], night: [MOON], sun: 2 },
  partly: {
    day: [
      'M8.5 4.5v1.2M3.6 9.5h1.2M5 6l.9.9M12 6l-.9.9',
      'M5.6 12.4a3.5 3.5 0 0 1 5.9-3.6',
      SMALL_CLOUD,
    ],
    sun: 2,
    night: ['M11.5 8.6A4.6 4.6 0 0 1 5.4 3a4.6 4.6 0 1 0 6.1 5.6z', SMALL_CLOUD],
  },
  cloudy: { day: [BIG_CLOUD] },
  fog: {
    day: [
      'M7 11a4 4 0 0 1-.3-8A5.5 5.5 0 0 1 17 4.3 3.4 3.4 0 0 1 17 11',
      'M4 15h16M6 18.5h12M8 22h8',
    ],
  },
  rain: { day: [CLOUD, 'M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3'] },
  snow: { day: [CLOUD, 'M8 18.5h.01M12 18.5h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01'] },
  storm: { day: [CLOUD, 'M13 13.5l-3 4.5h4l-3 4.5'] },
};

export default function SkyIcon({ sky, night, className = 'h-[17px] w-[17px]' }) {
  const p = SKY_PATHS[sky];
  if (!p) return null;
  const useNight = night && p.night;
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} text-slate-400`}
      aria-hidden="true"
    >
      {(useNight ? p.night : p.day).map((d, i) => {
        const sun = !useNight && i < (p.sun ?? 0);
        return (
          <path
            key={d}
            d={d}
            {...(sun ? { className: 'text-amber-500', stroke: 'currentColor' } : {})}
            {...(sun && d.endsWith('z') ? { fill: 'currentColor', fillOpacity: 0.3 } : {})}
          />
        );
      })}
    </svg>
  );
}
