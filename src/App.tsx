import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Droplets, Wind, Thermometer, Loader2, CloudSun, ChevronDown, ChevronUp, Leaf, Compass, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { Language, translations } from './translations';
import { searchLocations, getWeatherData, Location, WeatherData, getAirQualityData, getHistoricalWeather, HistoricalWeatherData } from './api';
import { getWeatherIcon } from './components/WeatherIcon';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showHourly, setShowHourly] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [historicalDate, setHistoricalDate] = useState<string>('');
  const [historicalWeather, setHistoricalWeather] = useState<HistoricalWeatherData | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const t = translations[lang];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0];

  useEffect(() => {
    // Load default location (Yangon)
    handleLocationSelect({
      id: 1,
      name: "Yangon",
      latitude: 16.80528,
      longitude: 96.15611,
      country: "Myanmar"
    });
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 2) {
        setSearching(true);
        try {
          const results = await searchLocations(query);
          setLocations(results);
        } catch (err) {
          console.error(err);
        } finally {
          setSearching(false);
        }
      } else {
        setLocations([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    if (selectedLocation && historicalDate) {
      const fetchHistory = async () => {
        setHistoricalLoading(true);
        try {
          const data = await getHistoricalWeather(selectedLocation.latitude, selectedLocation.longitude, historicalDate);
          setHistoricalWeather(data);
        } catch (err) {
          console.error(err);
          setHistoricalWeather(null);
        } finally {
          setHistoricalLoading(false);
        }
      };
      fetchHistory();
    }
  }, [selectedLocation, historicalDate]);

  const handleLocationSelect = async (loc: Location) => {
    setSelectedLocation(loc);
    setQuery('');
    setLocations([]);
    setLoading(true);
    setError(null);
    try {
      const [data, aqiData] = await Promise.all([
        getWeatherData(loc.latitude, loc.longitude),
        getAirQualityData(loc.latitude, loc.longitude).catch(() => null)
      ]);
      setWeather(data);
      setAqi(aqiData);
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError(t.locationError);
      return;
    }
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocoding is complex without an API key, so we'll just set coordinates
          setSelectedLocation({
            id: Date.now(),
            name: "Current Location",
            latitude,
            longitude,
            country: ""
          });
          const [data, aqiData] = await Promise.all([
            getWeatherData(latitude, longitude),
            getAirQualityData(latitude, longitude).catch(() => null)
          ]);
          setWeather(data);
          setAqi(aqiData);
        } catch (err) {
          setError(t.error);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(t.locationError);
        setLoading(false);
      }
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(lang === 'my' ? 'my-MM' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const formatHour = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(lang === 'my' ? 'my-MM' : 'en-US', {
      hour: 'numeric',
      hour12: true
    }).format(date);
  };

  const getAqiInfo = (aqiValue: number) => {
    if (aqiValue <= 50) return { label: t.aqiLevels.good, color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    if (aqiValue <= 100) return { label: t.aqiLevels.moderate, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (aqiValue <= 150) return { label: t.aqiLevels.unhealthySensitive, color: 'text-orange-400', bg: 'bg-orange-500/20' };
    if (aqiValue <= 200) return { label: t.aqiLevels.unhealthy, color: 'text-red-400', bg: 'bg-red-500/20' };
    if (aqiValue <= 300) return { label: t.aqiLevels.veryUnhealthy, color: 'text-purple-400', bg: 'bg-purple-500/20' };
    return { label: t.aqiLevels.hazardous, color: 'text-rose-500', bg: 'bg-rose-500/20' };
  };

  const getWindDirectionLabel = (degrees: number) => {
    const directionsEn = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const directionsMy = ['မြောက်', 'မြောက်-အရှေ့မြောက်', 'အရှေ့မြောက်', 'အရှေ့-အရှေ့မြောက်', 'အရှေ့', 'အရှေ့-အရှေ့တောင်', 'အရှေ့တောင်', 'တောင်-အရှေ့တောင်', 'တောင်', 'တောင်-အနောက်တောင်', 'အနောက်တောင်', 'အနောက်-အနောက်တောင်', 'အနောက်', 'အနောက်-အနောက်မြောက်', 'အနောက်မြောက်', 'မြောက်-အနောက်မြောက်'];
    const index = Math.round((degrees % 360) / 22.5);
    return lang === 'en' ? directionsEn[index % 16] : directionsMy[index % 16];
  };

  const playWeatherAnnouncement = async () => {
    if (!weather || !selectedLocation) return;
    
    if (isPlaying && audioSource) {
      audioSource.stop();
      setIsPlaying(false);
      return;
    }

    setAudioLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const textToRead = lang === 'en' 
        ? `Currently in ${selectedLocation.name}, the weather is ${t.weatherCodes[weather.current.weather_code]}. The temperature is ${Math.round(weather.current.temperature_2m)} degrees, feeling like ${Math.round(weather.current.apparent_temperature)} degrees. Humidity is at ${weather.current.relative_humidity_2m} percent, and wind speed is ${weather.current.wind_speed_10m} kilometers per hour.`
        : `ယခု ${selectedLocation.name} တွင် ရာသီဥတုမှာ ${t.weatherCodes[weather.current.weather_code]} ဖြစ်ပါသည်။ အပူချိန်မှာ ${Math.round(weather.current.temperature_2m)} ဒီဂရီ ရှိပြီး ${Math.round(weather.current.apparent_temperature)} ဒီဂရီ ဟု ခံစားရပါသည်။ စိုထိုင်းဆမှာ ${weather.current.relative_humidity_2m} ရာခိုင်နှုန်း ဖြစ်ပြီး လေတိုက်နှုန်းမှာ တစ်နာရီလျှင် ${weather.current.wind_speed_10m} ကီလိုမီတာ ဖြစ်ပါသည်။`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToRead }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) setAudioContext(ctx);

        let audioBuffer: AudioBuffer;
        
        try {
          // Try to decode as standard audio (WAV, MP3)
          const bytesCopy = new Uint8Array(bytes).buffer;
          audioBuffer = await ctx.decodeAudioData(bytesCopy);
        } catch (e) {
          // Fallback to raw 16-bit PCM at 24000Hz
          const pcm16 = new Int16Array(bytes.buffer);
          audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < pcm16.length; i++) {
            channelData[i] = pcm16[i] / 32768.0;
          }
        }
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        
        setAudioSource(source);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Failed to generate audio", err);
    } finally {
      setAudioLoading(false);
    }
  };

  let next24Hours = null;
  if (weather) {
    const now = new Date();
    const currentHourIndex = weather.hourly.time.findIndex(t => new Date(t).getTime() >= now.getTime() - 3600000);
    const startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;
    
    next24Hours = {
      time: weather.hourly.time.slice(startIndex, startIndex + 24),
      temperature_2m: weather.hourly.temperature_2m.slice(startIndex, startIndex + 24),
      weather_code: weather.hourly.weather_code.slice(startIndex, startIndex + 24),
      precipitation: weather.hourly.precipitation.slice(startIndex, startIndex + 24),
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
              <CloudSun size={28} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.appTitle}</h1>
          </div>
          
          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setLang('en')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${lang === 'en' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('my')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${lang === 'my' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              မြန်မာ
            </button>
          </div>
        </header>

        {/* Search Section */}
        <div className="relative mb-8 z-50">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-500"
              />
              {searching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              )}
            </div>
            <button
              onClick={handleUseLocation}
              className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center"
              title={t.useLocation}
            >
              <MapPin size={20} />
            </button>
          </div>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {locations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
              >
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleLocationSelect(loc)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors flex flex-col border-b border-slate-700/50 last:border-0"
                  >
                    <span className="font-medium text-slate-200">{loc.name}</span>
                    <span className="text-sm text-slate-400">
                      {loc.admin1 ? `${loc.admin1}, ` : ''}{loc.country}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-indigo-500" />
            <p>{t.loading}</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : weather && selectedLocation ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Current Weather Card */}
            <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                {getWeatherIcon(weather.current.weather_code, 200)}
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-slate-400 mb-6">
                  <MapPin size={18} />
                  <h2 className="text-lg font-medium">
                    {selectedLocation.name}
                    {selectedLocation.country && <span className="text-slate-500">, {selectedLocation.country}</span>}
                  </h2>
                  <button
                    onClick={playWeatherAnnouncement}
                    disabled={audioLoading}
                    className="ml-auto p-3 bg-indigo-500/20 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label={isPlaying ? t.stopAnnouncement : t.playAnnouncement}
                    title={isPlaying ? t.stopAnnouncement : t.playAnnouncement}
                  >
                    {audioLoading ? <Loader2 size={20} className="animate-spin" /> : (isPlaying ? <VolumeX size={20} /> : <Volume2 size={20} />)}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 mb-10">
                  <div className="flex items-center gap-6">
                    <div className="text-indigo-400 drop-shadow-lg">
                      {getWeatherIcon(weather.current.weather_code, 80)}
                    </div>
                    <div>
                      <div className="text-6xl sm:text-7xl font-bold tracking-tighter">
                        {Math.round(weather.current.temperature_2m)}°
                      </div>
                      <div className="text-xl text-slate-300 mt-2 font-medium">
                        {t.weatherCodes[weather.current.weather_code] || "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Droplets size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{t.humidity}</div>
                      <div className="text-lg font-semibold">{weather.current.relative_humidity_2m}%</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                    <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                      <Wind size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{t.windSpeed}</div>
                      <div className="text-lg font-semibold">{weather.current.wind_speed_10m} km/h</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                    <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <Compass size={20} style={{ transform: `rotate(${weather.current.wind_direction_10m}deg)` }} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{t.windDirection}</div>
                      <div className="text-lg font-semibold">{getWindDirectionLabel(weather.current.wind_direction_10m)}</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                    <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg">
                      <Thermometer size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{t.feelsLike}</div>
                      <div className="text-lg font-semibold">{Math.round(weather.current.apparent_temperature)}°</div>
                    </div>
                  </div>
                  {aqi !== null && (
                    <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                      <div className={`p-2 rounded-lg ${getAqiInfo(aqi).bg} ${getAqiInfo(aqi).color}`}>
                        <Leaf size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">{t.airQuality}</div>
                        <div className="text-lg font-semibold flex items-baseline gap-1">
                          {aqi} <span className="text-xs font-normal text-slate-400">AQI</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hourly Forecast Toggle */}
            <div className="mt-6 mb-2">
              <button
                onClick={() => setShowHourly(!showHourly)}
                className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium transition-colors bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50"
              >
                {showHourly ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                {showHourly ? t.hideHourly : t.showHourly}
              </button>
            </div>

            {/* Hourly Forecast Content */}
            <AnimatePresence>
              {showHourly && next24Hours && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-8"
                >
                  <h3 className="text-xl font-semibold mb-4 text-slate-200 pt-2">{t.hourlyForecast}</h3>
                  <div className="flex overflow-x-auto pb-4 gap-3 snap-x hide-scrollbar">
                    {next24Hours.time.map((time, index) => (
                      <div
                        key={time}
                        className="min-w-[100px] bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center text-center snap-start"
                      >
                        <div className="text-sm text-slate-400 mb-2 whitespace-nowrap">
                          {index === 0 ? (lang === 'en' ? 'Now' : 'ယခု') : formatHour(time)}
                        </div>
                        <div className="text-indigo-400 mb-3">
                          {getWeatherIcon(next24Hours.weather_code[index], 28)}
                        </div>
                        <div className="text-lg font-semibold text-slate-200 mb-1">
                          {Math.round(next24Hours.temperature_2m[index])}°
                        </div>
                        <div className="text-xs text-blue-400 flex items-center gap-1">
                          <Droplets size={12} />
                          {next24Hours.precipitation[index]}mm
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 7-Day Forecast */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-200">{t.forecast}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {weather.daily.time.map((time, index) => (
                  <div 
                    key={time} 
                    className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center text-center hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="text-sm text-slate-400 mb-2">
                      {index === 0 ? (lang === 'en' ? 'Today' : 'ယနေ့') : formatDate(time)}
                    </div>
                    <div className="text-indigo-400 mb-3">
                      {getWeatherIcon(weather.daily.weather_code[index], 32)}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-200">{Math.round(weather.daily.temperature_2m_max[index])}°</span>
                      <span className="text-slate-500">{Math.round(weather.daily.temperature_2m_min[index])}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Weather */}
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4 text-slate-200">{t.historicalWeather}</h3>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                  <label className="text-slate-400 font-medium">{t.selectDate}:</label>
                  <input
                    type="date"
                    max={maxDate}
                    value={historicalDate}
                    onChange={(e) => setHistoricalDate(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                {historicalLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                  </div>
                ) : historicalWeather && historicalWeather.daily.time.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                      <div className="text-indigo-400 drop-shadow-lg">
                        {getWeatherIcon(historicalWeather.daily.weather_code[0], 40)}
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">{t.weatherCodes[historicalWeather.daily.weather_code[0]] || "Unknown"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                      <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg">
                        <Thermometer size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">{t.maxTemp}</div>
                        <div className="text-lg font-semibold">{Math.round(historicalWeather.daily.temperature_2m_max[0])}°</div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                      <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                        <Thermometer size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">{t.minTemp}</div>
                        <div className="text-lg font-semibold">{Math.round(historicalWeather.daily.temperature_2m_min[0])}°</div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-700/30">
                      <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                        <Droplets size={20} />
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">{t.precipitation}</div>
                        <div className="text-lg font-semibold">{historicalWeather.daily.precipitation_sum[0]} mm</div>
                      </div>
                    </div>
                  </div>
                ) : historicalDate ? (
                  <div className="text-slate-400 py-4 text-center">{t.noData}</div>
                ) : (
                  <div className="text-slate-500 py-4 text-center">{t.selectDate}</div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
