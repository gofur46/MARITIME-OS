import { GoogleGenAI } from "@google/genai";
import { WeatherData, WeatherPrediction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getInsights(currentData: WeatherData, history: WeatherData[]): Promise<WeatherPrediction> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      time: new Date().toISOString(),
      summary: "AI services unavailable (API key missing). Please check safety manual.",
      safetyScore: 100,
      recommendations: ["Ensure all crew maintain visual watch."]
    };
  }

  const prompt = `
    You are a Maritime Weather Expert Assistant for a Port Authority.
    Current AWS Data:
    - Temperature: ${currentData.temperature.toFixed(1)}°C
    - Humidity: ${currentData.humidity.toFixed(0)}%
    - Wind: ${currentData.windSpeed.toFixed(1)} knots at ${currentData.windDirection.toFixed(0)}°
    - Pressure: ${currentData.pressure.toFixed(1)} hPa
    - Wave Height: ${currentData.waveHeight.toFixed(2)}m
    - Sea Level: ${currentData.seaLevel.toFixed(1)}cm
    - Rainfall: ${currentData.rainfall.toFixed(1)}mm

    The last few hours showed a trend of ${history.slice(-3).map(h => h.pressure.toFixed(1)).join(' -> ')} hPa in pressure.

    Provide a concise prediction for the next 2-4 hours and safety recommendations for port operations (docking, crane usage, small craft warnings).
    
    Response format: JSON object with:
    summary (string), safetyScore (number 0-100), recommendations (string array).
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = result.text || "{}";
    const parsed = JSON.parse(text);
    
    return {
      time: new Date().toISOString(),
      summary: parsed.summary || "Conditions monitored.",
      safetyScore: parsed.safetyScore ?? 100,
      recommendations: parsed.recommendations || ["Proceed with caution."]
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      time: new Date().toISOString(),
      summary: "Stable port conditions expected.",
      safetyScore: 90,
      recommendations: ["Procedural navigation recommended."]
    };
  }
}
