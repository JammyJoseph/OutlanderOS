import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type SeedEvent = {
  title: string
  date: string
  endDate?: string
  category: string
  subcategory?: string
  location?: string
  description?: string
  source?: string
  sourceUrl?: string
  importance?: number
  recurring?: boolean
  tags?: string[]
}

const events: SeedEvent[] = [
  // ===== FASHION =====
  { title: 'New York Fashion Week — FW25', date: '2025-02-06', endDate: '2025-02-13', category: 'fashion', subcategory: 'fashion week', location: 'New York, USA', description: 'NYFW womenswear shows for Fall/Winter 2025.', importance: 92, tags: ['nyfw', 'womenswear'] },
  { title: 'London Fashion Week — FW25', date: '2025-02-20', endDate: '2025-02-25', category: 'fashion', subcategory: 'fashion week', location: 'London, UK', description: 'LFW womenswear shows for Fall/Winter 2025.', importance: 92, tags: ['lfw', 'womenswear'] },
  { title: 'Milan Fashion Week — FW25', date: '2025-02-25', endDate: '2025-03-03', category: 'fashion', subcategory: 'fashion week', location: 'Milan, Italy', description: 'MFW womenswear shows for Fall/Winter 2025.', importance: 94, tags: ['mfw', 'womenswear'] },
  { title: 'Paris Fashion Week — FW25', date: '2025-03-03', endDate: '2025-03-11', category: 'fashion', subcategory: 'fashion week', location: 'Paris, France', description: 'PFW womenswear shows for Fall/Winter 2025.', importance: 96, tags: ['pfw', 'womenswear'] },
  { title: 'New York Fashion Week — SS26', date: '2025-09-11', endDate: '2025-09-16', category: 'fashion', subcategory: 'fashion week', location: 'New York, USA', description: 'NYFW shows for Spring/Summer 2026.', importance: 92, tags: ['nyfw', 'ss26'] },
  { title: 'London Fashion Week — SS26', date: '2025-09-18', endDate: '2025-09-22', category: 'fashion', subcategory: 'fashion week', location: 'London, UK', description: 'LFW shows for Spring/Summer 2026.', importance: 92, tags: ['lfw', 'ss26'] },
  { title: 'Milan Fashion Week — SS26', date: '2025-09-23', endDate: '2025-09-29', category: 'fashion', subcategory: 'fashion week', location: 'Milan, Italy', description: 'MFW shows for Spring/Summer 2026.', importance: 94, tags: ['mfw', 'ss26'] },
  { title: 'Paris Fashion Week — SS26', date: '2025-09-29', endDate: '2025-10-07', category: 'fashion', subcategory: 'fashion week', location: 'Paris, France', description: 'PFW shows for Spring/Summer 2026.', importance: 96, tags: ['pfw', 'ss26'] },
  { title: 'Paris Haute Couture Week — SS25', date: '2025-01-27', endDate: '2025-01-30', category: 'fashion', subcategory: 'couture', location: 'Paris, France', description: 'Spring/Summer haute couture presentations.', importance: 95, tags: ['couture', 'paris'] },
  { title: 'Paris Haute Couture Week — FW25', date: '2025-07-07', endDate: '2025-07-10', category: 'fashion', subcategory: 'couture', location: 'Paris, France', description: 'Fall/Winter haute couture presentations.', importance: 95, tags: ['couture', 'paris'] },
  { title: 'Pitti Uomo 107', date: '2025-01-14', endDate: '2025-01-17', category: 'fashion', subcategory: 'menswear', location: 'Florence, Italy', description: 'Premier menswear trade fair.', importance: 80, tags: ['menswear', 'pitti'] },
  { title: 'Pitti Uomo 108', date: '2025-06-17', endDate: '2025-06-20', category: 'fashion', subcategory: 'menswear', location: 'Florence, Italy', description: 'Premier menswear trade fair, summer edition.', importance: 80, tags: ['menswear', 'pitti'] },
  { title: 'Met Gala 2025', date: '2025-05-05', category: 'fashion', subcategory: 'gala', location: 'New York, USA', description: 'Costume Institute Benefit at the Met. Theme: Superfine — Tailoring Black Style.', importance: 99, tags: ['met', 'red-carpet'] },
  { title: 'Met Gala 2026', date: '2026-05-04', category: 'fashion', subcategory: 'gala', location: 'New York, USA', description: 'Costume Institute Benefit at the Met.', importance: 99, tags: ['met', 'red-carpet'] },
  { title: 'CFDA Fashion Awards 2025', date: '2025-11-03', category: 'fashion', subcategory: 'awards', location: 'New York, USA', description: 'Council of Fashion Designers of America annual awards.', importance: 88, tags: ['cfda', 'awards'] },
  { title: 'British Fashion Awards 2025', date: '2025-12-01', category: 'fashion', subcategory: 'awards', location: 'London, UK', description: 'BFC Fashion Awards at Royal Albert Hall.', importance: 87, tags: ['bfa', 'awards'] },
  { title: 'Copenhagen Fashion Week — AW25', date: '2025-01-27', endDate: '2025-01-31', category: 'fashion', subcategory: 'fashion week', location: 'Copenhagen, Denmark', description: 'Scandinavian fashion week with sustainability focus.', importance: 78, tags: ['cphfw', 'scandi'] },
  { title: 'Copenhagen Fashion Week — SS26', date: '2025-08-04', endDate: '2025-08-08', category: 'fashion', subcategory: 'fashion week', location: 'Copenhagen, Denmark', description: 'Scandinavian fashion week, summer edition.', importance: 78, tags: ['cphfw', 'scandi'] },
  { title: 'Pitti Bimbo 100', date: '2025-01-16', endDate: '2025-01-18', category: 'fashion', subcategory: 'kidswear', location: 'Florence, Italy', description: 'Childrenswear trade fair.', importance: 65, tags: ['kidswear', 'pitti'] },
  { title: 'Mercedes-Benz Fashion Week Tbilisi', date: '2025-05-08', endDate: '2025-05-12', category: 'fashion', subcategory: 'fashion week', location: 'Tbilisi, Georgia', description: 'Emerging Eastern European fashion showcase.', importance: 70, tags: ['emerging'] },
  { title: 'Seoul Fashion Week — SS26', date: '2025-09-02', endDate: '2025-09-06', category: 'fashion', subcategory: 'fashion week', location: 'Seoul, South Korea', description: 'Asia’s major fashion week.', importance: 75, tags: ['asia', 'sfw'] },

  // ===== ART =====
  { title: 'Art Basel Hong Kong', date: '2025-03-28', endDate: '2025-03-30', category: 'art', subcategory: 'art fair', location: 'Hong Kong', description: 'Premier Asian art fair.', importance: 88, tags: ['art-basel', 'asia'] },
  { title: 'Art Basel', date: '2025-06-19', endDate: '2025-06-22', category: 'art', subcategory: 'art fair', location: 'Basel, Switzerland', description: 'The flagship Art Basel fair.', importance: 95, tags: ['art-basel'] },
  { title: 'Art Basel Paris', date: '2025-10-22', endDate: '2025-10-26', category: 'art', subcategory: 'art fair', location: 'Paris, France', description: 'Grand Palais edition of Art Basel.', importance: 90, tags: ['art-basel', 'paris'] },
  { title: 'Art Basel Miami Beach', date: '2025-12-04', endDate: '2025-12-07', category: 'art', subcategory: 'art fair', location: 'Miami, USA', description: 'Largest American contemporary art fair.', importance: 92, tags: ['art-basel', 'miami'] },
  { title: 'Frieze London', date: '2025-10-15', endDate: '2025-10-19', category: 'art', subcategory: 'art fair', location: 'London, UK', description: 'Frieze London + Frieze Masters in Regent’s Park.', importance: 90, tags: ['frieze'] },
  { title: 'Frieze New York', date: '2025-05-07', endDate: '2025-05-11', category: 'art', subcategory: 'art fair', location: 'New York, USA', description: 'Frieze New York at The Shed.', importance: 86, tags: ['frieze'] },
  { title: 'Frieze Los Angeles', date: '2025-02-20', endDate: '2025-02-23', category: 'art', subcategory: 'art fair', location: 'Los Angeles, USA', description: 'Frieze LA at Santa Monica Airport.', importance: 84, tags: ['frieze', 'la'] },
  { title: 'Frieze Seoul', date: '2025-09-03', endDate: '2025-09-06', category: 'art', subcategory: 'art fair', location: 'Seoul, South Korea', description: 'Frieze Seoul at COEX.', importance: 84, tags: ['frieze', 'asia'] },
  { title: 'TEFAF Maastricht', date: '2025-03-15', endDate: '2025-03-20', category: 'art', subcategory: 'art fair', location: 'Maastricht, Netherlands', description: 'European Fine Art Fair.', importance: 83, tags: ['tefaf'] },
  { title: 'Venice Biennale 2026 (preview)', date: '2026-04-23', endDate: '2026-04-25', category: 'art', subcategory: 'biennale', location: 'Venice, Italy', description: 'Preview days of the 61st Venice Biennale.', importance: 96, tags: ['biennale', 'venice'] },
  { title: 'Whitney Biennial 2026', date: '2026-03-19', endDate: '2026-08-09', category: 'art', subcategory: 'biennale', location: 'New York, USA', description: 'Whitney Museum of American Art biennial exhibition.', importance: 85, tags: ['biennale', 'whitney'] },
  { title: 'Sharjah Biennial 16', date: '2025-02-06', endDate: '2025-06-15', category: 'art', subcategory: 'biennale', location: 'Sharjah, UAE', description: 'Sharjah Art Foundation’s 16th biennial.', importance: 78, tags: ['biennale', 'mena'] },
  { title: 'Documenta 16 announcement', date: '2025-05-15', category: 'art', subcategory: 'biennale', location: 'Kassel, Germany', description: 'Curatorial direction announcement for documenta 16.', importance: 72, tags: ['documenta'] },
  { title: 'Photo London', date: '2025-05-15', endDate: '2025-05-18', category: 'art', subcategory: 'photography fair', location: 'London, UK', description: 'International photography fair at Somerset House.', importance: 76, tags: ['photo-london'] },
  { title: 'Paris Photo', date: '2025-11-13', endDate: '2025-11-16', category: 'art', subcategory: 'photography fair', location: 'Paris, France', description: 'Largest international art fair dedicated to photography.', importance: 84, tags: ['paris-photo'] },
  { title: 'The Armory Show', date: '2025-09-04', endDate: '2025-09-07', category: 'art', subcategory: 'art fair', location: 'New York, USA', description: 'Modern and contemporary art at Javits Center.', importance: 82, tags: ['armory'] },
  { title: 'FIAC reset / Art Basel Paris+ Public Programme', date: '2025-10-20', endDate: '2025-10-26', category: 'art', subcategory: 'art week', location: 'Paris, France', description: 'Citywide gallery and museum programming for Paris Art Week.', importance: 80, tags: ['paris', 'art-week'] },

  // ===== FILM =====
  { title: 'Sundance Film Festival 2025', date: '2025-01-23', endDate: '2025-02-02', category: 'film', subcategory: 'festival', location: 'Park City, USA', description: 'Independent film festival.', importance: 85, tags: ['sundance'] },
  { title: 'Berlin International Film Festival (Berlinale)', date: '2025-02-13', endDate: '2025-02-23', category: 'film', subcategory: 'festival', location: 'Berlin, Germany', description: 'A-list European film festival.', importance: 88, tags: ['berlinale'] },
  { title: 'SXSW Film Festival', date: '2025-03-07', endDate: '2025-03-15', category: 'film', subcategory: 'festival', location: 'Austin, USA', description: 'Film, music, and tech festival.', importance: 80, tags: ['sxsw'] },
  { title: 'Cannes Film Festival', date: '2025-05-13', endDate: '2025-05-24', category: 'film', subcategory: 'festival', location: 'Cannes, France', description: 'The most prestigious film festival in the world.', importance: 98, tags: ['cannes'] },
  { title: 'Venice Film Festival', date: '2025-08-27', endDate: '2025-09-06', category: 'film', subcategory: 'festival', location: 'Venice, Italy', description: 'Mostra Internazionale d’Arte Cinematografica.', importance: 90, tags: ['venice'] },
  { title: 'Toronto International Film Festival (TIFF)', date: '2025-09-04', endDate: '2025-09-14', category: 'film', subcategory: 'festival', location: 'Toronto, Canada', description: 'Major awards-season launchpad.', importance: 88, tags: ['tiff'] },
  { title: 'New York Film Festival', date: '2025-09-26', endDate: '2025-10-12', category: 'film', subcategory: 'festival', location: 'New York, USA', description: 'Lincoln Center’s curated film festival.', importance: 80, tags: ['nyff'] },
  { title: 'BFI London Film Festival', date: '2025-10-08', endDate: '2025-10-19', category: 'film', subcategory: 'festival', location: 'London, UK', description: 'British Film Institute’s annual film festival.', importance: 82, tags: ['bfi', 'london'] },
  { title: 'Telluride Film Festival', date: '2025-08-29', endDate: '2025-09-01', category: 'film', subcategory: 'festival', location: 'Telluride, USA', description: 'Influential boutique film festival.', importance: 78, tags: ['telluride'] },
  { title: 'Tribeca Festival', date: '2025-06-04', endDate: '2025-06-15', category: 'film', subcategory: 'festival', location: 'New York, USA', description: 'Multi-discipline festival founded by Robert De Niro.', importance: 75, tags: ['tribeca'] },

  // ===== AWARDS =====
  { title: 'Golden Globe Awards', date: '2025-01-05', category: 'awards', subcategory: 'film & tv', location: 'Los Angeles, USA', description: '82nd Golden Globe Awards.', importance: 90, tags: ['globes'] },
  { title: 'Critics’ Choice Awards', date: '2025-01-12', category: 'awards', subcategory: 'film & tv', location: 'Los Angeles, USA', description: '30th Critics’ Choice Awards.', importance: 78, tags: ['ccca'] },
  { title: 'Grammy Awards', date: '2025-02-02', category: 'awards', subcategory: 'music', location: 'Los Angeles, USA', description: '67th Annual Grammy Awards.', importance: 95, tags: ['grammys'] },
  { title: 'BAFTA Film Awards', date: '2025-02-16', category: 'awards', subcategory: 'film', location: 'London, UK', description: 'British Academy Film Awards at the Royal Festival Hall.', importance: 90, tags: ['baftas'] },
  { title: 'Academy Awards (Oscars)', date: '2025-03-02', category: 'awards', subcategory: 'film', location: 'Los Angeles, USA', description: '97th Academy Awards.', importance: 99, tags: ['oscars'] },
  { title: 'Tony Awards', date: '2025-06-08', category: 'awards', subcategory: 'theatre', location: 'New York, USA', description: '78th Tony Awards.', importance: 80, tags: ['tonys'] },
  { title: 'Primetime Emmy Awards', date: '2025-09-14', category: 'awards', subcategory: 'tv', location: 'Los Angeles, USA', description: '77th Primetime Emmy Awards.', importance: 92, tags: ['emmys'] },
  { title: 'Turner Prize', date: '2025-12-09', category: 'awards', subcategory: 'art', location: 'Bradford, UK', description: 'Turner Prize 2025 ceremony.', importance: 82, tags: ['turner'] },
  { title: 'MTV Video Music Awards', date: '2025-09-07', category: 'awards', subcategory: 'music', location: 'New York, USA', description: '2025 MTV VMAs.', importance: 78, tags: ['vmas'] },
  { title: 'Stirling Prize', date: '2025-10-16', category: 'awards', subcategory: 'architecture', location: 'London, UK', description: 'RIBA Stirling Prize for the best new building.', importance: 80, tags: ['riba', 'architecture'] },
  { title: 'Pritzker Prize Announcement', date: '2025-03-04', category: 'awards', subcategory: 'architecture', location: 'Global', description: 'The 2025 Pritzker Architecture Prize laureate.', importance: 85, tags: ['pritzker'] },
  { title: 'Booker Prize', date: '2025-11-11', category: 'awards', subcategory: 'literature', location: 'London, UK', description: 'The 2025 Booker Prize ceremony.', importance: 80, tags: ['booker'] },

  // ===== MUSIC =====
  { title: 'Coachella Weekend 1', date: '2025-04-11', endDate: '2025-04-13', category: 'music', subcategory: 'festival', location: 'Indio, USA', description: 'Coachella Valley Music and Arts Festival.', importance: 90, tags: ['coachella'] },
  { title: 'Coachella Weekend 2', date: '2025-04-18', endDate: '2025-04-20', category: 'music', subcategory: 'festival', location: 'Indio, USA', description: 'Coachella second weekend.', importance: 85, tags: ['coachella'] },
  { title: 'Glastonbury Festival', date: '2025-06-25', endDate: '2025-06-29', category: 'music', subcategory: 'festival', location: 'Pilton, UK', description: 'Glastonbury Festival of Contemporary Performing Arts.', importance: 92, tags: ['glasto'] },
  { title: 'Primavera Sound Barcelona', date: '2025-06-04', endDate: '2025-06-07', category: 'music', subcategory: 'festival', location: 'Barcelona, Spain', description: 'Indie and alternative music festival.', importance: 80, tags: ['primavera'] },
  { title: 'Lollapalooza Chicago', date: '2025-07-31', endDate: '2025-08-03', category: 'music', subcategory: 'festival', location: 'Chicago, USA', description: 'Grant Park music festival.', importance: 80, tags: ['lolla'] },
  { title: 'Reading & Leeds Festival', date: '2025-08-22', endDate: '2025-08-24', category: 'music', subcategory: 'festival', location: 'Reading & Leeds, UK', description: 'Twin-site UK summer festival.', importance: 75, tags: ['reading-leeds'] },
  { title: 'Notting Hill Carnival', date: '2025-08-23', endDate: '2025-08-25', category: 'music', subcategory: 'carnival', location: 'London, UK', description: 'Annual celebration of Caribbean culture.', importance: 84, tags: ['carnival', 'london'] },
  { title: 'BBC Proms — Last Night', date: '2025-09-13', category: 'music', subcategory: 'classical', location: 'London, UK', description: 'Last Night of the BBC Proms.', importance: 78, tags: ['proms'] },
  { title: 'Mercury Prize', date: '2025-10-09', category: 'music', subcategory: 'awards', location: 'London, UK', description: 'Mercury Prize Album of the Year ceremony.', importance: 76, tags: ['mercury'] },
  { title: 'Latin Grammy Awards', date: '2025-11-13', category: 'music', subcategory: 'awards', location: 'Las Vegas, USA', description: '26th Annual Latin Grammy Awards.', importance: 80, tags: ['latin-grammys'] },

  // ===== DESIGN =====
  { title: 'Salone del Mobile (Milan Design Week)', date: '2025-04-08', endDate: '2025-04-13', category: 'design', subcategory: 'design week', location: 'Milan, Italy', description: 'World’s biggest furniture and design fair.', importance: 95, tags: ['salone', 'milan'] },
  { title: 'London Design Festival', date: '2025-09-13', endDate: '2025-09-21', category: 'design', subcategory: 'design week', location: 'London, UK', description: 'Citywide festival across V&A, Brompton, Shoreditch.', importance: 88, tags: ['ldf'] },
  { title: 'Design Miami', date: '2025-12-02', endDate: '2025-12-07', category: 'design', subcategory: 'design fair', location: 'Miami, USA', description: 'Collectible design fair alongside Art Basel Miami Beach.', importance: 85, tags: ['design-miami'] },
  { title: 'Design Miami / Paris', date: '2025-10-22', endDate: '2025-10-26', category: 'design', subcategory: 'design fair', location: 'Paris, France', description: 'Paris edition of Design Miami at Hôtel de Maisons.', importance: 80, tags: ['design-miami', 'paris'] },
  { title: 'Maison&Objet Paris (January)', date: '2025-01-16', endDate: '2025-01-20', category: 'design', subcategory: 'design fair', location: 'Paris, France', description: 'Lifestyle and home decor trade show.', importance: 78, tags: ['mo'] },
  { title: 'Maison&Objet Paris (September)', date: '2025-09-04', endDate: '2025-09-08', category: 'design', subcategory: 'design fair', location: 'Paris, France', description: 'Lifestyle and home decor trade show, autumn edition.', importance: 78, tags: ['mo'] },
  { title: 'Stockholm Design Week', date: '2025-02-03', endDate: '2025-02-09', category: 'design', subcategory: 'design week', location: 'Stockholm, Sweden', description: 'Scandinavian design showcase including Stockholm Furniture Fair.', importance: 78, tags: ['stockholm'] },
  { title: 'Dutch Design Week', date: '2025-10-18', endDate: '2025-10-26', category: 'design', subcategory: 'design week', location: 'Eindhoven, Netherlands', description: 'Annual Dutch design showcase.', importance: 75, tags: ['ddw'] },
  { title: '3 Days of Design', date: '2025-06-18', endDate: '2025-06-20', category: 'design', subcategory: 'design week', location: 'Copenhagen, Denmark', description: 'Citywide design event in Copenhagen.', importance: 76, tags: ['3dd'] },
  { title: 'NYCxDESIGN', date: '2025-05-15', endDate: '2025-05-21', category: 'design', subcategory: 'design week', location: 'New York, USA', description: 'NYC official design week.', importance: 78, tags: ['nycxdesign'] },

  // ===== FOOD =====
  { title: 'World’s 50 Best Restaurants', date: '2025-06-19', category: 'food', subcategory: 'awards', location: 'Turin, Italy', description: 'World’s 50 Best Restaurants 2025 ceremony.', importance: 85, tags: ['50best'] },
  { title: 'Michelin Guide France', date: '2025-03-31', category: 'food', subcategory: 'guide release', location: 'France', description: 'Annual Michelin Guide France release.', importance: 86, tags: ['michelin', 'france'] },
  { title: 'Michelin Guide Great Britain & Ireland', date: '2025-02-03', category: 'food', subcategory: 'guide release', location: 'London, UK', description: 'Annual Michelin Guide GB&I release.', importance: 84, tags: ['michelin', 'uk'] },
  { title: 'James Beard Awards', date: '2025-06-16', category: 'food', subcategory: 'awards', location: 'Chicago, USA', description: 'James Beard Foundation annual awards.', importance: 82, tags: ['beard'] },
  { title: 'Identità Golose Milano', date: '2025-02-08', endDate: '2025-02-10', category: 'food', subcategory: 'congress', location: 'Milan, Italy', description: 'International chef congress.', importance: 70, tags: ['gastronomy'] },
  { title: 'Madrid Fusión', date: '2025-01-27', endDate: '2025-01-29', category: 'food', subcategory: 'congress', location: 'Madrid, Spain', description: 'Premier international gastronomy summit.', importance: 75, tags: ['gastronomy'] },
  { title: 'Vinexpo Paris', date: '2025-02-10', endDate: '2025-02-12', category: 'food', subcategory: 'wine', location: 'Paris, France', description: 'International wine and spirits trade fair.', importance: 70, tags: ['wine'] },
  { title: 'Taste of London', date: '2025-06-18', endDate: '2025-06-22', category: 'food', subcategory: 'festival', location: 'London, UK', description: 'Regent’s Park food festival.', importance: 65, tags: ['taste-london'] },

  // ===== CULTURE =====
  { title: 'World Press Photo Exhibition London', date: '2025-11-07', endDate: '2025-12-14', category: 'culture', subcategory: 'photography', location: 'London, UK', description: 'World Press Photo annual touring exhibition.', importance: 70, tags: ['photography'] },
  { title: 'Hay Festival', date: '2025-05-22', endDate: '2025-06-01', category: 'culture', subcategory: 'literature', location: 'Hay-on-Wye, UK', description: 'Festival of literature and arts.', importance: 76, tags: ['hay', 'literature'] },
  { title: 'Edinburgh Festival Fringe', date: '2025-08-01', endDate: '2025-08-25', category: 'culture', subcategory: 'theatre', location: 'Edinburgh, UK', description: 'World’s largest performing arts festival.', importance: 88, tags: ['fringe'] },
  { title: 'Edinburgh International Festival', date: '2025-08-01', endDate: '2025-08-24', category: 'culture', subcategory: 'theatre', location: 'Edinburgh, UK', description: 'International festival of music, opera, theatre, and dance.', importance: 80, tags: ['edinburgh'] },
  { title: 'Burning Man', date: '2025-08-24', endDate: '2025-09-01', category: 'culture', subcategory: 'gathering', location: 'Black Rock Desert, USA', description: 'Counter-cultural gathering in the desert.', importance: 78, tags: ['burning-man'] },
  { title: 'Documenta 16 (preview)', date: '2027-06-12', endDate: '2027-06-14', category: 'culture', subcategory: 'biennale', location: 'Kassel, Germany', description: 'Preview days for documenta 16.', importance: 80, tags: ['documenta'] },
  { title: 'Carnival of Venice', date: '2025-02-15', endDate: '2025-03-04', category: 'culture', subcategory: 'carnival', location: 'Venice, Italy', description: 'Historic Venetian carnival.', importance: 72, tags: ['carnival'] },
  { title: 'Diwali', date: '2025-10-21', category: 'culture', subcategory: 'holiday', location: 'Global', description: 'Hindu festival of lights.', importance: 75, recurring: true, tags: ['holiday'] },
  { title: 'Lunar New Year', date: '2025-01-29', category: 'culture', subcategory: 'holiday', location: 'Global', description: 'Year of the Snake.', importance: 80, recurring: true, tags: ['holiday'] },
  { title: 'Pride Month begins', date: '2025-06-01', category: 'culture', subcategory: 'holiday', location: 'Global', description: 'Pride Month celebrations begin worldwide.', importance: 80, recurring: true, tags: ['pride'] },

  // ===== SPORT =====
  { title: 'Super Bowl LIX', date: '2025-02-09', category: 'sport', subcategory: 'american football', location: 'New Orleans, USA', description: 'Super Bowl LIX at Caesars Superdome.', importance: 95, tags: ['super-bowl'] },
  { title: 'The Masters Tournament', date: '2025-04-10', endDate: '2025-04-13', category: 'sport', subcategory: 'golf', location: 'Augusta, USA', description: 'The Masters at Augusta National.', importance: 88, tags: ['masters'] },
  { title: 'Roland-Garros (French Open)', date: '2025-05-25', endDate: '2025-06-08', category: 'sport', subcategory: 'tennis', location: 'Paris, France', description: 'French Open Grand Slam.', importance: 85, tags: ['rg', 'tennis'] },
  { title: 'Wimbledon', date: '2025-06-30', endDate: '2025-07-13', category: 'sport', subcategory: 'tennis', location: 'London, UK', description: 'The Championships, Wimbledon.', importance: 90, tags: ['wimbledon', 'tennis'] },
  { title: 'Tour de France', date: '2025-07-05', endDate: '2025-07-27', category: 'sport', subcategory: 'cycling', location: 'France', description: '112th Tour de France.', importance: 85, tags: ['tdf'] },
  { title: 'F1 Monaco Grand Prix', date: '2025-05-25', category: 'sport', subcategory: 'motorsport', location: 'Monaco', description: 'Monaco Grand Prix at the Circuit de Monaco.', importance: 90, tags: ['f1', 'monaco'] },
  { title: 'F1 British Grand Prix', date: '2025-07-06', category: 'sport', subcategory: 'motorsport', location: 'Silverstone, UK', description: 'British Grand Prix at Silverstone.', importance: 82, tags: ['f1'] },
  { title: 'NBA Finals 2025', date: '2025-06-05', endDate: '2025-06-22', category: 'sport', subcategory: 'basketball', location: 'USA', description: 'NBA Finals series.', importance: 85, tags: ['nba'] },
  { title: 'UEFA Champions League Final', date: '2025-05-31', category: 'sport', subcategory: 'football', location: 'Munich, Germany', description: 'Champions League Final at Allianz Arena.', importance: 92, tags: ['ucl', 'football'] },
  { title: 'FIFA World Cup 2026 (kickoff)', date: '2026-06-11', endDate: '2026-07-19', category: 'sport', subcategory: 'football', location: 'USA / Canada / Mexico', description: 'First expanded 48-team World Cup.', importance: 99, tags: ['world-cup', 'fifa'] },
  { title: 'Winter Olympics 2026 — Milano Cortina', date: '2026-02-06', endDate: '2026-02-22', category: 'sport', subcategory: 'olympics', location: 'Milan / Cortina, Italy', description: 'XXV Olympic Winter Games.', importance: 96, tags: ['olympics', 'winter'] },

  // ===== BRAND =====
  { title: 'Apple WWDC 2025', date: '2025-06-09', endDate: '2025-06-13', category: 'brand', subcategory: 'tech keynote', location: 'Cupertino, USA', description: 'Apple Worldwide Developers Conference.', importance: 90, tags: ['apple', 'wwdc'] },
  { title: 'Apple September Event', date: '2025-09-09', category: 'brand', subcategory: 'tech keynote', location: 'Cupertino, USA', description: 'Annual iPhone event.', importance: 92, tags: ['apple'] },
  { title: 'Cannes Lions Festival of Creativity', date: '2025-06-16', endDate: '2025-06-20', category: 'brand', subcategory: 'advertising', location: 'Cannes, France', description: 'Global creativity and advertising festival.', importance: 90, tags: ['cannes-lions'] },
  { title: 'SXSW 2025', date: '2025-03-07', endDate: '2025-03-15', category: 'brand', subcategory: 'tech & culture', location: 'Austin, USA', description: 'SXSW Conference & Festivals.', importance: 84, tags: ['sxsw'] },
  { title: 'CES 2025', date: '2025-01-07', endDate: '2025-01-10', category: 'brand', subcategory: 'tech', location: 'Las Vegas, USA', description: 'Consumer Electronics Show.', importance: 86, tags: ['ces'] },
  { title: 'Google I/O 2025', date: '2025-05-20', endDate: '2025-05-21', category: 'brand', subcategory: 'tech keynote', location: 'Mountain View, USA', description: 'Google’s annual developer conference.', importance: 86, tags: ['google'] },
  { title: 'OpenAI DevDay 2025', date: '2025-10-06', category: 'brand', subcategory: 'tech keynote', location: 'San Francisco, USA', description: 'OpenAI annual developer event.', importance: 84, tags: ['openai'] },
  { title: 'Web Summit Lisbon', date: '2025-11-10', endDate: '2025-11-13', category: 'brand', subcategory: 'tech', location: 'Lisbon, Portugal', description: 'Largest tech conference in Europe.', importance: 80, tags: ['web-summit'] },
  { title: 'Black Friday', date: '2025-11-28', category: 'brand', subcategory: 'commerce', location: 'Global', description: 'Global retail sales day.', importance: 86, recurring: true, tags: ['retail'] },
  { title: 'Singles’ Day (11.11)', date: '2025-11-11', category: 'brand', subcategory: 'commerce', location: 'China / Global', description: 'World’s biggest online shopping day.', importance: 82, recurring: true, tags: ['retail'] },
]

export async function POST() {
  const created = await prisma.$transaction(
    events.map((e) =>
      prisma.culturalEvent.create({
        data: {
          title: e.title,
          date: new Date(e.date),
          endDate: e.endDate ? new Date(e.endDate) : null,
          category: e.category,
          subcategory: e.subcategory,
          location: e.location,
          description: e.description,
          source: e.source,
          sourceUrl: e.sourceUrl,
          importance: e.importance ?? 50,
          recurring: e.recurring ?? false,
          tags: e.tags ?? [],
        },
      })
    )
  )
  return NextResponse.json({ created: created.length })
}

export async function DELETE() {
  const result = await prisma.culturalEvent.deleteMany({})
  return NextResponse.json({ deleted: result.count })
}
