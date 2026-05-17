import { z } from "zod";

export interface WeatherImpactInput {
  location?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
}

export interface WeatherImpactDay {
  date: string;
  precipitationMm: number;
  precipitationProbabilityPct: number;
  windSpeedKmh: number;
  windGustKmh: number;
  tempMinC: number;
  tempMaxC: number;
  risk: "low" | "medium" | "high";
  workability: "normal" | "caution" | "stop_recommended";
  reasons: string[];
}

export interface WeatherImpactResult {
  provider: "Open-Meteo";
  locationName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  days: WeatherImpactDay[];
  summary: string;
}

const geocodingResponseSchema = z.object({
  results: z.array(z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    country: z.string().optional(),
    admin1: z.string().optional(),
    timezone: z.string().optional(),
  })).optional(),
});

const forecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
    wind_speed_10m_max: z.array(z.number()),
    wind_gusts_10m_max: z.array(z.number()),
  }),
});

interface Coordinates {
  latitude: number;
  longitude: number;
  name: string;
}

export async function evaluateWeatherImpact(input: WeatherImpactInput): Promise<WeatherImpactResult> {
  const coordinates = await resolveCoordinates(input);
  const url = buildForecastUrl(coordinates, input);
  const response = await fetch(url, { next: { revalidate: 60 * 30 } });

  if (!response.ok) {
    throw new Error(`Open-Meteo forecast failed: ${response.status}`);
  }

  const forecast = forecastResponseSchema.parse(await response.json());
  const days = forecast.daily.time.map((date, index) => buildImpactDay(forecast.daily, date, index));
  const high = days.filter((day) => day.risk === "high").length;
  const medium = days.filter((day) => day.risk === "medium").length;

  return {
    provider: "Open-Meteo",
    locationName: coordinates.name,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    timezone: forecast.timezone,
    days,
    summary: high > 0
      ? `${high} dia(s) con riesgo alto para tareas sensibles a clima.`
      : medium > 0
        ? `${medium} dia(s) requieren precaucion operativa.`
        : "No se detectan restricciones meteorologicas relevantes para los proximos dias.",
  };
}

async function resolveCoordinates(input: WeatherImpactInput): Promise<Coordinates> {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      name: input.location ?? `${input.latitude}, ${input.longitude}`,
    };
  }

  const query = input.location?.trim();
  if (!query) {
    throw new Error("Indica una ubicacion o coordenadas para evaluar clima.");
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding failed: ${response.status}`);
  }

  const parsed = geocodingResponseSchema.parse(await response.json());
  const first = parsed.results?.[0];
  if (!first) {
    throw new Error(`No se encontraron coordenadas para "${query}".`);
  }

  return {
    latitude: first.latitude,
    longitude: first.longitude,
    name: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
  };
}

function buildForecastUrl(coordinates: Coordinates, input: WeatherImpactInput): URL {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
  ].join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("forecast_days", "7");

  if (input.startDate) url.searchParams.set("start_date", input.startDate);
  if (input.endDate) url.searchParams.set("end_date", input.endDate);

  return url;
}

function buildImpactDay(
  daily: z.infer<typeof forecastResponseSchema>["daily"],
  date: string,
  index: number
): WeatherImpactDay {
  const precipitationMm = daily.precipitation_sum[index] ?? 0;
  const precipitationProbabilityPct = daily.precipitation_probability_max[index] ?? 0;
  const windSpeedKmh = daily.wind_speed_10m_max[index] ?? 0;
  const windGustKmh = daily.wind_gusts_10m_max[index] ?? 0;
  const tempMinC = daily.temperature_2m_min[index] ?? 0;
  const tempMaxC = daily.temperature_2m_max[index] ?? 0;
  const reasons: string[] = [];

  if (precipitationProbabilityPct >= 70 || precipitationMm >= 15) {
    reasons.push("lluvia probable o acumulado alto");
  } else if (precipitationProbabilityPct >= 45 || precipitationMm >= 5) {
    reasons.push("lluvia posible");
  }

  if (windGustKmh >= 60 || windSpeedKmh >= 45) {
    reasons.push("viento fuerte para izajes, altura o cerramientos");
  } else if (windGustKmh >= 40 || windSpeedKmh >= 30) {
    reasons.push("viento moderado");
  }

  if (tempMaxC >= 36) reasons.push("calor extremo para hormigonado y HSE");
  if (tempMinC <= 2) reasons.push("frio intenso con riesgo para curado y tareas tempranas");

  const high = precipitationProbabilityPct >= 70 || precipitationMm >= 15 || windGustKmh >= 60 || tempMaxC >= 36 || tempMinC <= 2;
  const medium = precipitationProbabilityPct >= 45 || precipitationMm >= 5 || windGustKmh >= 40 || windSpeedKmh >= 30;

  return {
    date,
    precipitationMm,
    precipitationProbabilityPct,
    windSpeedKmh,
    windGustKmh,
    tempMinC,
    tempMaxC,
    risk: high ? "high" : medium ? "medium" : "low",
    workability: high ? "stop_recommended" : medium ? "caution" : "normal",
    reasons,
  };
}
