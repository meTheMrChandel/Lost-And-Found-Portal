// Tailwind runs through PostCSS so it works with both bundlers:
// Turbopack in `next dev` and webpack in `next build --webpack` (the production build on Vercel)
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
