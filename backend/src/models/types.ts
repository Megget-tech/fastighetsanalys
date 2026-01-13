// Geographic types
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export interface DeSoArea {
  deso_code: string;
  name: string;
  kommun_code: string;
  kommun_name: string;
  lan_code: string;
  lan_name: string;
  category: 'A' | 'B' | 'C';
  population: number;
  geom: any; // PostGIS geometry
}

export interface AreaMatchResult {
  deso_codes: string[];
  coverage_percentage: number;
  fallback_kommun?: string;
  warnings: string[];
}

// SCB Data types
export interface SCBMetric {
  metric_type: 'income' | 'population' | 'education' | 'migration' | 'demographics';
  metric_name: string;
  value: number;
  unit: string;
  time_period: Date;
}

export interface SCBTimeSeriesPoint {
  date: string;
  value: number;
}

export interface SCBTimeSeries {
  metric_type: string;
  metric_name: string;
  unit: string;
  data: SCBTimeSeriesPoint[];
}

export interface IncomeMetrics {
  median_income: number;
  mean_income: number;
  kommun_median?: number;
  riket_median?: number;
  percentile_20?: number;
  percentile_80?: number;
  year?: string;  // Data year (e.g. "2023", "2024")
}

export interface PopulationMetrics {
  total: number;
  growth_rate?: number;
  age_distribution?: AgeDistribution;
  kommun_avg?: {
    total: number;
    age_distribution?: AgeDistribution;
  };
  year?: string;  // Data year
  age_year?: string;  // Year for age distribution (may differ)
  historical_population?: PopulationHistoryPoint[];  // Population 2019-2024
  age_distribution_comparison?: {
    start_year: string;  // e.g. "2019"
    end_year: string;    // e.g. "2024"
    start_distribution: AgeDistribution;
    end_distribution: AgeDistribution;
  };
}

export interface PopulationHistoryPoint {
  year: string;
  population: number;
}

export interface AgeDistribution {
  '0-4': number;
  '5-9': number;
  '10-14': number;
  '15-19': number;
  '20-24': number;
  '25-29': number;
  '30-34': number;
  '35-39': number;
  '40-44': number;
  '45-49': number;
  '50-54': number;
  '55-59': number;
  '60-64': number;
  '65-69': number;
  '70-74': number;
  '75-79': number;
  '80+': number;
}

export interface EducationMetrics {
  forgymnasial: number;  // Förgymnasial
  gymnasial: number;      // Gymnasial
  eftergymnasial: number; // Eftergymnasial
  kommun_avg?: EducationMetrics;
  riket_avg?: EducationMetrics;
  year?: string;  // Data year
}

export interface MigrationMetrics {
  inflyttade: number;
  utflyttade: number;
  netto: number;
  origins?: {
    kommun_code: string;
    kommun_name?: string;
    count: number;
  }[];
  destinations?: {
    kommun_code: string;
    kommun_name?: string;
    count: number;
  }[];
  year?: string;  // Data year
}

export interface OriginBase {
  swedish_background: number;  // Svensk bakgrund
  foreign_background: number;  // Utländsk bakgrund
  percentage_foreign: number;  // Procent utländsk bakgrund
}

export interface OriginMetrics extends OriginBase {
  kommun_avg?: OriginBase;
  year?: string;  // Data year
}

export interface HouseholdBase {
  total_households: number;

  // By household type (SCB categories)
  ensamstaende_utan_barn: number;     // ESUB - Ensamstående utan barn
  ensamstaende_med_barn: number;      // ESMB - Ensamstående med barn
  par_utan_barn: number;              // SBUB - Sammanboende utan barn (par)
  familjer: number;                   // SBMB - Sammanboende med barn (familjer)
  ovriga: number;                     // OVRIGA - Övriga hushåll

  // Legacy size-based (for backwards compatibility, can be removed later)
  single_person?: number;      // 1 person
  two_person?: number;          // 2 personer
  three_plus_person?: number;   // 3+ personer

  average_household_size: number;
}

export interface HouseholdMetrics extends HouseholdBase {
  kommun_avg?: HouseholdBase;
  year?: string;  // Data year
}

export interface EconomicStandardBase {
  quartile_1: number;  // Andel personer i kvartil 1, procent
  quartile_2: number;  // Andel personer i kvartil 2, procent
  quartile_3: number;  // Andel personer i kvartil 3, procent
  quartile_4: number;  // Andel personer i kvartil 4, procent
  median_value: number;  // Medianvärde, tkr
  mean_value: number;    // Medelvärde, tkr
  total_persons: number; // Antal personer totalt
}

export interface EconomicStandardMetrics extends EconomicStandardBase {
  kommun_avg?: EconomicStandardBase;
  year?: string;  // Data year
}

export interface EarnedIncomeBase {
  quartile_1: number;  // Andel personer i kvartil 1, procent
  quartile_2: number;  // Andel personer i kvartil 2, procent
  quartile_3: number;  // Andel personer i kvartil 3, procent
  quartile_4: number;  // Andel personer i kvartil 4, procent
  median_value: number;  // Medianvärde förvärvsinkomst, tkr
  mean_value: number;    // Medelvärde förvärvsinkomst, tkr
  total_persons: number; // Antal personer totalt
}

export interface EarnedIncomeMetrics extends EarnedIncomeBase {
  kommun_avg?: EarnedIncomeBase;
  year?: string;  // Data year
}

export interface VehicleBase {
  total_vehicles: number;        // Totalt antal fordon
  vehicles_in_traffic: number;   // Fordon i trafik
  vehicles_deregistered: number; // Avregistrerade fordon
  vehicles_per_household?: number; // Bilar per hushåll (beräknat)
}

export interface VehicleMetrics extends VehicleBase {
  kommun_avg?: VehicleBase;
  year?: string;  // Data year
}

// Booli types
export interface BooliPropertySale {
  id: string;
  sold_date: Date;
  sold_price: number;
  list_price?: number;
  living_area: number;
  rooms: number;
  construction_year: number;
  object_type: 'Lägenhet' | 'Villa' | 'Radhus';
  address: string;
  deso_code?: string;
  lat: number;
  lng: number;
  is_new_construction: boolean;
  price_per_sqm: number;
}

export interface BooliMetrics {
  total_sales: number;
  avg_price: number;
  avg_price_per_sqm: number;
  new_production: {
    count: number;
    avg_price: number;
    avg_price_per_sqm: number;
  };
  succession: {
    count: number;
    avg_price: number;
    avg_price_per_sqm: number;
  };
  price_trend?: SCBTimeSeriesPoint[];
}

export interface HousingTypeBase {
  smahus: number;           // Småhus (Villa, Radhus, Kedjehus)
  flerbostadshus: number;   // Flerbostadshus (Lägenheter)
  percentage_smahus: number;
}

export interface HousingTypeMetrics extends HousingTypeBase {
  kommun_avg?: HousingTypeBase;
  year?: string;  // Data year
}

export interface TenureFormBase {
  aganderatt: number;       // Äganderätt
  bostadsratt: number;      // Bostadsrätt
  hyresratt: number;        // Hyresrätt
  percentage_aganderatt: number;
  percentage_bostadsratt: number;
  percentage_hyresratt: number;
}

export interface TenureFormMetrics extends TenureFormBase {
  kommun_avg?: TenureFormBase;
  year?: string;  // Data year
}

export interface BuildingAgePeriod {
  period: string;              // e.g. "1951-1960", "-1920", "2021-2030"
  count: number;               // Antal byggnader
  percentage: number;          // Andel i procent av totalt
}

export interface BuildingAgeBase {
  periods: BuildingAgePeriod[];  // Fördelning per period
  total_buildings: number;       // Totalt antal byggnader
  average_age?: number;          // Genomsnittlig ålder (approximerad från perioder)
}

export interface BuildingAgeMetrics extends BuildingAgeBase {
  kommun_avg?: BuildingAgeBase;
  year?: string;  // Data year
}

// Combined metrics
export interface AreaMetrics {
  deso_code: string;
  deso_name: string;
  kommun_name: string;
  income: IncomeMetrics;
  population: PopulationMetrics;
  education: EducationMetrics;
  migration: MigrationMetrics;
  origin: OriginMetrics;
  household: HouseholdMetrics;
  housing_type: HousingTypeMetrics;
  tenure_form: TenureFormMetrics;
  economic_standard: EconomicStandardMetrics;
  earned_income: EarnedIncomeMetrics;
  vehicles: VehicleMetrics;
  building_age: BuildingAgeMetrics;
  booli: BooliMetrics;
}

// API Cache
export interface CacheEntry {
  cache_key: string;
  api_source: 'scb' | 'booli' | 'lantmateriet';
  response_data: any;
  created_at: Date;
  expires_at: Date;
}

// API Request/Response types
export interface FindDeSoRequest {
  polygon: GeoJSONPolygon;
}

export interface FindDeSoResponse {
  deso_codes: string[];
  deso_names: string[];
  kommun_code: string;
  kommun_name: string;
  coverage_percentage: number;
  warnings: string[];
}

export interface GetMetricsResponse {
  deso_code: string;
  deso_name: string;
  kommun_name: string;
  metrics: {
    income: IncomeMetrics;
    population: PopulationMetrics;
    education: EducationMetrics;
    migration: MigrationMetrics;
    origin: OriginMetrics;
    household: HouseholdMetrics;
    housing_type: HousingTypeMetrics;
    tenure_form: TenureFormMetrics;
    economic_standard: EconomicStandardMetrics;
    earned_income: EarnedIncomeMetrics;
    vehicles: VehicleMetrics;
    building_age: BuildingAgeMetrics;
    booli: BooliMetrics;
  };
}

export interface GetTimeSeriesResponse {
  metric_type: string;
  metric_name: string;
  unit: string;
  deso_data: SCBTimeSeriesPoint[];
  kommun_data?: SCBTimeSeriesPoint[];
  riket_data?: SCBTimeSeriesPoint[];
}
