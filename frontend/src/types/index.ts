// Geographic types
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface DeSoArea {
  deso_code: string;
  name: string;
  kommun_code: string;
  kommun_name: string;
  lan_code: string;
  category: 'A' | 'B' | 'C';
  population: number;
}

// API Response types
export interface FindDeSoResponse {
  deso_codes: string[];
  deso_names: string[];
  kommun_code: string;
  kommun_name: string;
  coverage_percentage: number;
  warnings: string[];
}

export interface IncomeMetrics {
  median_income: number;
  mean_income: number;
  kommun_median?: number;
  riket_median?: number;
  percentile_20?: number;
  percentile_80?: number;
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

export interface PopulationHistoryPoint {
  year: string;
  population: number;
}

export interface PopulationMetrics {
  total: number;
  growth_rate?: number;
  age_distribution?: AgeDistribution;
  historical_population?: PopulationHistoryPoint[];
  age_distribution_comparison?: {
    start_year: string;
    end_year: string;
    start_distribution: AgeDistribution;
    end_distribution: AgeDistribution;
  };
}

export interface EducationMetrics {
  forgymnasial: number;
  gymnasial: number;
  eftergymnasial: number;
  kommun_avg?: EducationMetrics;
  riket_avg?: EducationMetrics;
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
}

export interface OriginMetrics {
  swedish_background: number;
  foreign_background: number;
  percentage_foreign: number;
}

export interface HouseholdMetrics {
  total_households: number;
  single_person: number;
  two_person: number;
  three_plus_person: number;
  average_household_size: number;
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
  price_trend?: TimeSeriesPoint[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface AreaMetrics {
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
    booli: BooliMetrics;
  };
}

export interface TimeSeriesData {
  metric_type: string;
  metric_name: string;
  unit: string;
  deso_data: TimeSeriesPoint[];
  kommun_data?: TimeSeriesPoint[];
  riket_data?: TimeSeriesPoint[];
}

export interface HousingTypeMetrics {
  smahus: number;
  flerbostadshus: number;
  percentage_smahus: number;
  kommun_avg?: {
    smahus: number;
    flerbostadshus: number;
    percentage_smahus: number;
  };
}

export interface TenureFormMetrics {
  aganderatt: number;
  bostadsratt: number;
  hyresratt: number;
  percentage_aganderatt: number;
  percentage_bostadsratt: number;
  percentage_hyresratt: number;
  kommun_avg?: {
    aganderatt: number;
    bostadsratt: number;
    hyresratt: number;
    percentage_aganderatt: number;
    percentage_bostadsratt: number;
    percentage_hyresratt: number;
  };
}

export interface EconomicStandardMetrics {
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
  kommun_avg?: {
    quartile_1: number;
    quartile_2: number;
    quartile_3: number;
    quartile_4: number;
    median_value: number;
    mean_value: number;
    total_persons: number;
  };
}

export interface EarnedIncomeMetrics {
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
  kommun_avg?: {
    quartile_1: number;
    quartile_2: number;
    quartile_3: number;
    quartile_4: number;
    median_value: number;
    mean_value: number;
    total_persons: number;
  };
}

export interface VehicleMetrics {
  total_vehicles: number;
  vehicles_in_traffic: number;
  vehicles_deregistered: number;
  vehicles_per_household?: number;
  kommun_avg?: {
    total_vehicles: number;
    vehicles_in_traffic: number;
    vehicles_deregistered: number;
    vehicles_per_household?: number;
  };
}

export interface BuildingAgePeriod {
  period: string;
  count: number;
  percentage: number;
}

export interface BuildingAgeMetrics {
  periods: BuildingAgePeriod[];
  total_buildings: number;
  average_age?: number;
  kommun_avg?: {
    periods: BuildingAgePeriod[];
    total_buildings: number;
    average_age?: number;
  };
  year?: string;
}

export interface AggregatedMetrics {
  area_count: number;
  deso_codes: string[];
  kommun_name: string;
  metrics: {
    income: IncomeMetrics;
    population: PopulationMetrics & {
      kommun_avg?: {
        total: number;
        age_distribution?: AgeDistribution;
      };
    };
    education: EducationMetrics;
    migration: MigrationMetrics;
    origin: OriginMetrics & {
      kommun_avg?: {
        swedish_background: number;
        foreign_background: number;
        percentage_foreign: number;
      };
    };
    household: HouseholdMetrics & {
      kommun_avg?: HouseholdMetrics;
    };
    housing_type: HousingTypeMetrics;
    tenure_form: TenureFormMetrics;
    economic_standard?: EconomicStandardMetrics;
    earned_income?: EarnedIncomeMetrics;
    vehicles?: VehicleMetrics;
    building_age?: BuildingAgeMetrics;
    booli?: BooliMetrics;
  };
}
