/**
 * DEMO DATA — every venue, event, person and post below is fictional and
 * exists only to showcase the product. Venues sit on real streets of real
 * neighbourhoods for a believable map, but none of them is a real business
 * and no event is a real, scheduled event. All rows are flagged `isDemo`.
 */

export interface SeedVenue {
  slug: string;
  name: string;
  city: string;
  type: "CLUB" | "BAR" | "CONCERT_HALL" | "OPEN_AIR";
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  genres: string[];
  priceMin: number; // euros
  priceMax: number;
  minAge?: number;
  description: string;
  days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  open: string;
  close: string;
  featured?: boolean;
}

export const VENUES: SeedVenue[] = [
  { slug: "sala-x", name: "Sala X", city: "barcelona", type: "CLUB", neighborhood: "Poblenou", address: "Carrer de Pujades, 118", lat: 41.3987, lng: 2.1962, genres: ["reggaeton", "comercial", "latin"], priceMin: 12, priceMax: 20, minAge: 18, description: "Dos salas, sonido potente y la pista más llena del Poblenou los fines de semana. Reggaeton en la principal y comercial en la sala pequeña.", days: ["thu", "fri", "sat"], open: "00:00", close: "06:00", featured: true },
  { slug: "sala-nebula", name: "Sala Nébula", city: "barcelona", type: "CLUB", neighborhood: "Poblenou", address: "Carrer de Pere IV, 212", lat: 41.4031, lng: 2.2004, genres: ["techno", "electronica"], priceMin: 15, priceMax: 25, minAge: 18, description: "Nave industrial reconvertida en templo del techno. Cabina central, luces minimalistas y sesiones largas hasta el amanecer.", days: ["fri", "sat"], open: "23:59", close: "07:00", featured: true },
  { slug: "club-vertice", name: "Club Vértice", city: "barcelona", type: "CLUB", neighborhood: "Eixample", address: "Carrer d'Aribau, 195", lat: 41.3934, lng: 2.1541, genres: ["comercial", "reggaeton"], priceMin: 10, priceMax: 18, minAge: 18, description: "Club de referencia del Eixample: comercial, hits de ahora y de siempre, y una terraza para respirar entre canción y canción.", days: ["wed", "thu", "fri", "sat"], open: "00:00", close: "05:30" },
  { slug: "la-fabrica-de-luz", name: "La Fábrica de Luz", city: "barcelona", type: "CLUB", neighborhood: "Poblenou", address: "Carrer de Llull, 150", lat: 41.4001, lng: 2.1978, genres: ["house", "techno"], priceMin: 12, priceMax: 22, minAge: 18, description: "Antigua fábrica textil con techos altísimos. House los viernes, techno los sábados y proyecciones de luz en todas las paredes.", days: ["fri", "sat"], open: "23:30", close: "06:00" },
  { slug: "terraza-marea", name: "Terraza Marea", city: "barcelona", type: "OPEN_AIR", neighborhood: "Port Olímpic", address: "Moll de Mestral, 30", lat: 41.3853, lng: 2.1985, genres: ["house", "comercial"], priceMin: 0, priceMax: 15, description: "Sesiones al atardecer frente al mar. Empieza tranquilo con house y sube de ritmo cuando cae el sol.", days: ["thu", "fri", "sat", "sun"], open: "18:00", close: "03:00", featured: true },
  { slug: "sotano-33", name: "Sótano 33", city: "barcelona", type: "BAR", neighborhood: "Gràcia", address: "Carrer de Verdi, 33", lat: 41.4037, lng: 2.1573, genres: ["indie", "electronica"], priceMin: 0, priceMax: 8, description: "Bar de barrio con cabina. Indie, electrónica suave y la mejor previa de Gràcia.", days: ["wed", "thu", "fri", "sat"], open: "20:00", close: "03:00" },
  { slug: "club-orbita", name: "Club Órbita", city: "barcelona", type: "CLUB", neighborhood: "Sants", address: "Carrer de Sants, 140", lat: 41.3753, lng: 2.1338, genres: ["reggaeton", "latin"], priceMin: 10, priceMax: 15, minAge: 18, description: "Perreo sin descanso. El club latino de Sants con DJs residentes y fiestas temáticas cada jueves.", days: ["thu", "fri", "sat"], open: "00:00", close: "06:00" },
  { slug: "mirador-club", name: "Mirador Club", city: "barcelona", type: "CLUB", neighborhood: "Montjuïc", address: "Passeig de Santa Madrona, 12", lat: 41.3702, lng: 2.1575, genres: ["house", "electronica"], priceMin: 15, priceMax: 30, minAge: 21, description: "Club con vistas a toda la ciudad. House elegante, cócteles y un jardín exterior en verano.", days: ["fri", "sat"], open: "23:00", close: "06:00", featured: true },
  { slug: "pulso", name: "Pulso", city: "barcelona", type: "CLUB", neighborhood: "El Raval", address: "Carrer de la Riera Alta, 20", lat: 41.3808, lng: 2.1662, genres: ["hip-hop"], priceMin: 8, priceMax: 12, minAge: 18, description: "Hip hop, trap y R&B. Batallas de freestyle los miércoles y jams con DJs locales.", days: ["wed", "fri", "sat"], open: "23:30", close: "05:00" },
  { slug: "neon-21", name: "Neón 21", city: "barcelona", type: "CLUB", neighborhood: "Gòtic", address: "Carrer dels Escudellers, 21", lat: 41.3798, lng: 2.1758, genres: ["comercial"], priceMin: 10, priceMax: 15, minAge: 18, description: "Pequeño, intenso y siempre lleno. Comercial y remember en pleno Barrio Gótico.", days: ["tue", "wed", "thu", "fri", "sat"], open: "23:59", close: "05:00" },
  { slug: "cupula", name: "Cúpula", city: "barcelona", type: "CLUB", neighborhood: "Diagonal Mar", address: "Carrer de Llull, 390", lat: 41.4089, lng: 2.2143, genres: ["electronica", "techno"], priceMin: 18, priceMax: 35, minAge: 18, description: "Gran formato: 3.000 personas bajo una cúpula de LEDs. Line-ups internacionales (demo) y producción espectacular.", days: ["sat"], open: "23:00", close: "07:00" },
  { slug: "bahia-latina", name: "Bahía Latina", city: "barcelona", type: "CLUB", neighborhood: "Barceloneta", address: "Passeig de Joan de Borbó, 60", lat: 41.3792, lng: 2.1888, genres: ["latin", "reggaeton"], priceMin: 10, priceMax: 15, minAge: 18, description: "Salsa hasta la 1 y reggaeton hasta el cierre. A dos pasos de la playa.", days: ["thu", "fri", "sat", "sun"], open: "22:30", close: "05:00" },
  { slug: "estudio-nocturno", name: "Estudio Nocturno", city: "barcelona", type: "CLUB", neighborhood: "Sant Antoni", address: "Carrer del Comte Borrell, 80", lat: 41.3789, lng: 2.1598, genres: ["house"], priceMin: 10, priceMax: 18, minAge: 18, description: "Club íntimo para amantes del house: vinilos, buen sistema de sonido y público que viene a bailar.", days: ["thu", "fri", "sat"], open: "23:59", close: "06:00" },
  { slug: "garaje-sonico", name: "Garaje Sónico", city: "barcelona", type: "CONCERT_HALL", neighborhood: "Poble-sec", address: "Carrer de Blai, 44", lat: 41.3738, lng: 2.1627, genres: ["hip-hop", "techno", "indie"], priceMin: 8, priceMax: 20, description: "Sala de conciertos que se convierte en club al terminar el directo.", days: ["wed", "thu", "fri", "sat"], open: "21:00", close: "05:00" },
  { slug: "azotea-aurora", name: "Azotea Aurora", city: "barcelona", type: "BAR", neighborhood: "Eixample", address: "Passeig de Gràcia, 70", lat: 41.3935, lng: 2.1636, genres: ["comercial", "house"], priceMin: 0, priceMax: 10, description: "Rooftop con DJ para empezar la noche con vistas. Ideal para la previa.", days: ["wed", "thu", "fri", "sat", "sun"], open: "19:00", close: "02:30" },
  { slug: "refugio-gracia", name: "Refugio", city: "barcelona", type: "BAR", neighborhood: "Gràcia", address: "Travessera de Gràcia, 180", lat: 41.4012, lng: 2.1561, genres: ["indie", "comercial"], priceMin: 0, priceMax: 6, description: "El bar donde acaban todas las noches de Gràcia. Pop, indie y karaoke los domingos.", days: ["thu", "fri", "sat", "sun"], open: "21:00", close: "03:00" },
  { slug: "club-cenit", name: "Club Cénit", city: "barcelona", type: "CLUB", neighborhood: "Les Corts", address: "Avinguda de Sarrià, 110", lat: 41.3906, lng: 2.1392, genres: ["reggaeton", "comercial"], priceMin: 12, priceMax: 20, minAge: 18, description: "Club universitario por excelencia: fiestas temáticas, promos de entrada y mucho reggaeton.", days: ["wed", "thu", "fri", "sat"], open: "00:00", close: "05:30" },
  // Other cities (to show multi-city support)
  { slug: "sala-prisma", name: "Sala Prisma", city: "madrid", type: "CLUB", neighborhood: "Malasaña", address: "Calle del Espíritu Santo, 20", lat: 40.4262, lng: -3.7045, genres: ["indie", "electronica"], priceMin: 10, priceMax: 15, minAge: 18, description: "Indie y electrónica en el corazón de Malasaña.", days: ["thu", "fri", "sat"], open: "00:00", close: "06:00" },
  { slug: "club-meridiano", name: "Club Meridiano", city: "madrid", type: "CLUB", neighborhood: "Chueca", address: "Calle de Hortaleza, 60", lat: 40.4227, lng: -3.6981, genres: ["house", "comercial"], priceMin: 12, priceMax: 20, minAge: 18, description: "House y pop hasta el amanecer.", days: ["fri", "sat"], open: "00:00", close: "06:00" },
  { slug: "nave-9", name: "Nave 9", city: "madrid", type: "CLUB", neighborhood: "Arganzuela", address: "Paseo de la Chopera, 9", lat: 40.3988, lng: -3.6962, genres: ["techno"], priceMin: 15, priceMax: 25, minAge: 18, description: "Techno industrial en una nave junto al río.", days: ["sat"], open: "23:59", close: "08:00" },
  { slug: "club-albufera", name: "Club Albufera", city: "valencia", type: "CLUB", neighborhood: "Ruzafa", address: "Carrer de Sueca, 40", lat: 39.4623, lng: -0.3752, genres: ["reggaeton", "comercial"], priceMin: 10, priceMax: 15, minAge: 18, description: "La noche de Ruzafa empieza y acaba aquí.", days: ["thu", "fri", "sat"], open: "00:00", close: "06:00" },
  { slug: "la-termica", name: "La Térmica", city: "valencia", type: "CLUB", neighborhood: "El Carmen", address: "Carrer de Cavallers, 30", lat: 39.4768, lng: -0.3791, genres: ["techno", "house"], priceMin: 12, priceMax: 20, minAge: 18, description: "Club underground en El Carmen.", days: ["fri", "sat"], open: "23:59", close: "06:30" },
];

export interface SeedStreetParty {
  title: string;
  city: string;
  category: "fm" | "fiesta" | "concierto" | "dj" | "otro";
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  genres: string[];
  description: string;
  /** Day offset from "tonight" and local times. */
  day: number;
  start: string;
  end: string;
  price: number;
  featured?: boolean;
}

export const STREET_EVENTS: SeedStreetParty[] = [
  { title: "FM Gràcia", city: "barcelona", category: "fm", locationName: "Plaça del Sol", address: "Plaça del Sol, Gràcia", lat: 41.4026, lng: 2.1567, genres: ["comercial", "reggaeton"], description: "Fiesta abierta en Gràcia. Escenario en la plaza, barras del barrio y DJs locales hasta la madrugada. (Evento de demostración)", day: 0, start: "22:00", end: "05:00", price: 0, featured: true },
  { title: "FM Sants — Escenario Joven", city: "barcelona", category: "fm", locationName: "Plaça de Sants", address: "Plaça de Sants, Sants", lat: 41.3757, lng: 2.1357, genres: ["reggaeton", "hip-hop"], description: "Escenario joven de la fiesta del barrio: DJs emergentes y batallas de baile. (Evento de demostración)", day: 0, start: "21:30", end: "03:00", price: 0 },
  { title: "Verbena Poblenou", city: "barcelona", category: "fm", locationName: "Rambla del Poblenou", address: "Rambla del Poblenou, 60", lat: 41.4016, lng: 2.2009, genres: ["comercial", "latin"], description: "Verbena popular en la Rambla con orquesta y DJ al final. (Evento de demostración)", day: 1, start: "22:00", end: "03:00", price: 0 },
  { title: "Correfoc & DJ al carrer", city: "barcelona", category: "fiesta", locationName: "Carrer de Verdi", address: "Carrer de Verdi, Gràcia", lat: 41.4046, lng: 2.1578, genres: ["electronica"], description: "Después del correfoc, la calle se convierte en pista. (Evento de demostración)", day: 1, start: "23:00", end: "03:00", price: 0 },
  { title: "Beach Sunset Session", city: "barcelona", category: "dj", locationName: "Platja de la Nova Icària", address: "Platja de la Nova Icària", lat: 41.3902, lng: 2.2025, genres: ["house"], description: "Sesión de house al atardecer en la playa. Trae tu toalla. (Evento de demostración)", day: 2, start: "18:30", end: "22:30", price: 0, featured: true },
  { title: "Fiesta Mayor de Barceloneta", city: "barcelona", category: "fm", locationName: "Plaça de la Barceloneta", address: "Plaça de la Barceloneta", lat: 41.3808, lng: 2.1896, genres: ["latin", "comercial"], description: "Música en directo, sardinada y DJ hasta tarde. (Evento de demostración)", day: 3, start: "21:00", end: "02:00", price: 0 },
  { title: "Jam de Hip Hop al Parc", city: "barcelona", category: "concierto", locationName: "Parc de Joan Miró", address: "Carrer d'Aragó, 2", lat: 41.3778, lng: 2.1488, genres: ["hip-hop"], description: "Micro abierto, graffiti en directo y DJs. (Evento de demostración)", day: 2, start: "17:00", end: "22:00", price: 0 },
  { title: "Rooftop Party Sant Antoni", city: "barcelona", category: "fiesta", locationName: "Terrat del Mercat", address: "Carrer del Comte d'Urgell, 1", lat: 41.3795, lng: 2.1618, genres: ["house", "comercial"], description: "Fiesta en azotea con aforo limitado. (Evento de demostración)", day: 6, start: "20:00", end: "01:00", price: 12 },
  { title: "FM Les Corts", city: "barcelona", category: "fm", locationName: "Plaça de la Concòrdia", address: "Plaça de la Concòrdia, Les Corts", lat: 41.3857, lng: 2.1305, genres: ["comercial"], description: "Fiesta mayor con conciertos y discomóvil. (Evento de demostración)", day: 9, start: "21:00", end: "03:00", price: 0 },
  { title: "Techno Open Air", city: "barcelona", category: "dj", locationName: "Parc del Fòrum", address: "Parc del Fòrum", lat: 41.4108, lng: 2.2263, genres: ["techno"], description: "Escenario al aire libre junto al mar, 10 horas de techno. (Evento de demostración)", day: 8, start: "16:00", end: "02:00", price: 25, featured: true },
  { title: "Fiesta en Lavapiés", city: "madrid", category: "fm", locationName: "Plaza de Lavapiés", address: "Plaza de Lavapiés", lat: 40.4088, lng: -3.7008, genres: ["latin"], description: "Fiesta de barrio (demostración).", day: 0, start: "21:00", end: "02:00", price: 0 },
  { title: "Noche en Ruzafa", city: "valencia", category: "fiesta", locationName: "Plaça del Barri", address: "Ruzafa", lat: 39.4633, lng: -0.3747, genres: ["comercial"], description: "Fiesta de barrio (demostración).", day: 1, start: "22:00", end: "03:00", price: 0 },
];

/** Recurring nights per venue: title templates (day offset relative to tonight). */
export const VENUE_NIGHT_TITLES: Record<string, string[]> = {
  reggaeton: ["Perreo Nights", "Reggaeton Session", "La Noche del Perreo", "Dembow Club"],
  techno: ["Warehouse", "Techno Marathon", "Dark Room", "Industrial Session"],
  house: ["House Sessions", "Deep Friday", "Vinyl Only", "Sunset to Sunrise"],
  "hip-hop": ["Hip Hop Jam", "Trap House", "Old School Night", "Freestyle Battle"],
  comercial: ["NIGHT SESSION", "Hits Party", "Remember Night", "Saturday Fever"],
  electronica: ["Electronic Garden", "Synth Night", "Afterglow", "Modular"],
  latin: ["Latin Fever", "Salsa & Perreo", "Noche Tropical", "Bachata Club"],
  indie: ["Indie Club", "Guitarras y Sintes", "Britpop Night", "Pop Culture"],
};

/** Fictional DJ names used in event titles. */
export const DJS = ["DJ Kora", "Nerea V", "Lucas Brume", "MVRA", "Soto", "Kiara Lux", "Tomás Deep", "OLA", "Rubén Nox", "Duna B"];

export const USERS = [
  { username: "eric", displayName: "Eric", bio: "Barcelona nightlife" },
  { username: "ana.rm", displayName: "Ana", bio: "Techno los sábados, brunch los domingos ☕" },
  { username: "juanp", displayName: "Juan", bio: "Fotógrafo de noche 📸" },
  { username: "laia_bcn", displayName: "Laia", bio: "Gràcia forever 💛" },
  { username: "marc.dj", displayName: "Marc", bio: "DJ amateur · house & disco" },
  { username: "paula.night", displayName: "Paula", bio: "Siempre en primera fila" },
  { username: "nil", displayName: "Nil", bio: "Hip hop head" },
  { username: "carla.v", displayName: "Carla", bio: "Reggaeton y buena gente" },
  { username: "pol_f", displayName: "Pol", bio: "Si hay FM, estoy" },
  { username: "julia.m", displayName: "Júlia", bio: "Indie kid" },
  { username: "alex.go", displayName: "Álex", bio: "After > previa" },
  { username: "sofia.ln", displayName: "Sofía", bio: "Latin vibes 💃" },
  { username: "hugo", displayName: "Hugo", bio: "Techno & coffee" },
  { username: "martina", displayName: "Martina", bio: "Sunset sessions lover 🌅" },
  { username: "dani.r", displayName: "Dani", bio: "Poblenou" },
  { username: "irene", displayName: "Irene", bio: "Bailar es mi cardio" },
  { username: "leo.bcn", displayName: "Leo", bio: "Noches largas" },
  { username: "noa", displayName: "Noa", bio: "House music all night long" },
  { username: "biel", displayName: "Biel", bio: "Festes de barri i bona música" },
  { username: "claudia", displayName: "Claudia", bio: "Rooftops & cocktails" },
  { username: "iker", displayName: "Iker", bio: "De Madrid a Barcelona" },
  { username: "lucia.p", displayName: "Lucía", bio: "Photos from the dancefloor" },
  { username: "oriol", displayName: "Oriol", bio: "Vinyl digger" },
  { username: "valeria", displayName: "Valeria", bio: "Siempre la última en irse" },
];

export const POST_CAPTIONS = [
  "Anoche en Gràcia 🔥",
  "Así estaba la sala a las 3 AM",
  "Mi grupo antes de salir 💫",
  "After de ayer, no me arrepiento de nada",
  "Qué sesión, de verdad",
  "Primera vez aquí y ya quiero volver",
  "Cuando pone ESA canción 😭",
  "La cola merecía la pena",
  "Sunset, música y buena gente",
  "El sonido de este sitio es otra cosa",
  "Esto es lo que pasa cuando dices 'solo una'",
  "Modo fin de semana activado",
  "Luces, humo y techno",
  "La pista a tope desde la 1",
  "Previa en la azotea 🌆",
  "Nadie quería que acabase",
];

export const VIDEO_CAPTIONS = [
  "Así estaba la pista a las 3 AM 🔊",
  "DJ Kora esta noche, qué drop",
  "Cuando entra el bajo…",
  "Lo mejor de anoche en 10 segundos",
  "La FM de Gràcia a tope",
  "Luces de otro planeta",
  "El último tema de la noche",
  "Sunset session desde la terraza",
];

export const COMMENTS = [
  "Qué ambiente!!",
  "Yo también estaba 🙌",
  "Hay que repetir",
  "¿Qué tema es este?",
  "Brutal la sesión",
  "Te vi desde la barra jajaja",
  "Next time me apunto",
  "El sonido de esa sala es top",
  "¿A qué hora acabó?",
  "🔥🔥🔥",
  "Guardado para el finde",
  "Qué envidia",
];

export const REVIEW_COMMENTS = [
  "Buen ambiente y música.",
  "El sonido es espectacular, aunque las copas son caras.",
  "Personal muy amable y la pista nunca está vacía.",
  "Demasiada cola para entrar, pero dentro se está genial.",
  "Música top toda la noche.",
  "Un poco pequeño, pero con mucho rollo.",
  "De mis sitios favoritos de la ciudad.",
  "Buena selección musical, volveré.",
  "Mucha gente, difícil moverse a partir de las 3.",
  "El DJ residente es increíble.",
  "Precio razonable para lo que ofrece.",
  "Buen sitio para empezar la noche.",
];
