# Using Area Context Data in Agents

## Overview
Area context data is automatically collected and stored in `state["area_context"]` when a property designation or location is provided in the project parameters. This guide shows how agents can use this data in their analyses.

## Area Context Data Structure

```python
{
  "location": {
    "name": "Kvarnholmen, Nacka, Nacka kommun, Stockholms län, 131 37, Sverige",
    "coordinates": [59.3157233, 18.1385701],
    "municipality": "Nacka kommun"
  },
  "services_within_1km": {
    "education": {
      "schools": 0,
      "kindergartens": 0,
      "closest_school": null
    },
    "retail": {
      "supermarkets": 0,
      "convenience_stores": 1,
      "closest_supermarket": null
    },
    "health": {
      "healthcare_centers": 0,
      "pharmacies": 0,
      "closest_pharmacy": null
    },
    "fitness": {
      "gyms": 13,
      "top_rated_gym": {
        "name": "Bonobo Gym",
        "rating": 5.0,
        "reviews": 19
      },
      "source": "google_places"
    },
    "dining": {
      "restaurants": 20,
      "cafes": 4,
      "bars": 4,
      "top_rated_restaurant": {
        "name": "Lilla Don",
        "rating": 5.0,
        "reviews": 4
      },
      "top_rated_cafe": {
        "name": "Era Ora Kvarnholmen",
        "rating": 5.0,
        "reviews": 24
      },
      "source": "google_places"
    },
    "recreation": {
      "parks": 5,
      "playgrounds": 21
    }
  },
  "transit_access": {
    "available": true,
    "closest_stop": {
      "name": "Kvarnholmens centrum (Nacka kn)",
      "distance_m": 124,
      "lines": ["402", "93"]
    },
    "frequency_analysis": {
      "description": "Avgång var 10:e minut",
      "average_frequency_min": 10,
      "total_departures_weekday": 66
    },
    "travel_times": {},
    "nearby_stops_count": 10
  },
  "recreation": {
    "parks": 5,
    "playgrounds": 21
  },
  "data_sources": {
    "osm": true,
    "trafiklab": true,
    "google_places": true
  },
  "summary": "Kvarnholmen, Nacka har 0 skolor, 0 mataffär(er), 20 restauranger och 4 caféer inom 1 km. Kollektivtrafik: utmärkt."
}
```

## How to Access Area Context in Agents

### 1. Check if Area Context is Available

```python
def analyze(state: AnalysisState) -> Dict[str, Any]:
    # Check if area context data is available
    area_context = state.get("area_context")

    if not area_context:
        # Handle case where area context is not available
        return {
            "status": "completed",
            "confidence_score": 0.8,
            "output": {
                "note": "Area context not available"
            }
        }

    # Use area context data...
```

### 2. Extract Relevant Information

```python
# Get location information
location_name = area_context.get("location", {}).get("name")
municipality = area_context.get("location", {}).get("municipality")

# Get services
services = area_context.get("services_within_1km", {})
schools = services.get("education", {}).get("schools", 0)
restaurants = services.get("dining", {}).get("restaurants", 0)
gyms = services.get("fitness", {}).get("gyms", 0)

# Get transit information
transit = area_context.get("transit_access", {})
if transit.get("available"):
    closest_stop = transit.get("closest_stop", {})
    stop_name = closest_stop.get("name")
    distance_m = closest_stop.get("distance_m")
    frequency = transit.get("frequency_analysis", {}).get("description")
```

## Use Cases by Agent

### Demographics Analyst
Use area context to understand target demographic preferences:

```python
# Check if area has family-friendly amenities
schools = services.get("education", {}).get("schools", 0)
playgrounds = area_context.get("recreation", {}).get("playgrounds", 0)

if schools > 2 and playgrounds > 5:
    insight = "Area well-suited for families with children"

# Check if area appeals to young professionals
restaurants = services.get("dining", {}).get("restaurants", 0)
cafes = services.get("dining", {}).get("cafes", 0)
gyms = services.get("fitness", {}).get("gyms", 0)

if restaurants > 10 and cafes > 3 and gyms > 5:
    insight = "Strong appeal to young professionals"
```

### Market Intelligence Analyst
Use area context to understand market positioning:

```python
# Analyze commercial vibrancy
dining = services.get("dining", {})
if dining.get("source") == "google_places" and dining.get("top_rated_restaurant"):
    top_restaurant = dining["top_rated_restaurant"]
    insight = f"High-quality dining scene with {dining['restaurants']} restaurants, including {top_restaurant['name']} (rating: {top_restaurant['rating']})"

# Analyze transit accessibility
transit = area_context.get("transit_access", {})
if transit.get("available"):
    closest = transit.get("closest_stop", {})
    distance = closest.get("distance_m", 999)

    if distance < 200:
        transit_quality = "Excellent transit access"
    elif distance < 500:
        transit_quality = "Good transit access"
    else:
        transit_quality = "Moderate transit access"
```

### Pricing Strategist
Use area context to justify pricing:

```python
# Calculate amenity score
amenity_score = 0
services = area_context.get("services_within_1km", {})

# Weight different amenities
amenity_score += services.get("dining", {}).get("restaurants", 0) * 2
amenity_score += services.get("fitness", {}).get("gyms", 0) * 3
amenity_score += services.get("retail", {}).get("supermarkets", 0) * 5

# Check transit
transit = area_context.get("transit_access", {})
if transit.get("available"):
    closest = transit.get("closest_stop", {})
    if closest.get("distance_m", 999) < 300:
        amenity_score += 20

    freq = transit.get("frequency_analysis", {}).get("average_frequency_min", 60)
    if freq < 15:
        amenity_score += 15

# Use score to adjust pricing
if amenity_score > 80:
    pricing_adjustment = 1.10  # 10% premium
elif amenity_score > 50:
    pricing_adjustment = 1.05  # 5% premium
else:
    pricing_adjustment = 1.00
```

### Product Mix Optimizer
Use area context to recommend unit distribution:

```python
# Analyze area characteristics
services = area_context.get("services_within_1km", {})
transit = area_context.get("transit_access", {})

# Check if family-oriented
schools = services.get("education", {}).get("schools", 0)
playgrounds = area_context.get("recreation", {}).get("playgrounds", 0)

if schools > 2 and playgrounds > 10:
    # Recommend more larger units
    recommendation = {
        "3_rok": 0.30,
        "4_rok": 0.25,
        "2_rok": 0.35,
        "1_rok": 0.10
    }
    rationale = "Family-oriented area with good schools and playgrounds"

# Check if young professional area
restaurants = services.get("dining", {}).get("restaurants", 0)
gyms = services.get("fitness", {}).get("gyms", 0)
transit_good = transit.get("available") and transit.get("closest_stop", {}).get("distance_m", 999) < 300

if restaurants > 15 and gyms > 8 and transit_good:
    # Recommend more smaller units
    recommendation = {
        "1_rok": 0.25,
        "2_rok": 0.45,
        "3_rok": 0.25,
        "4_rok": 0.05
    }
    rationale = "Urban area attractive to young professionals"
```

### Synthesis Analyst
Use area context for holistic assessment:

```python
# Create comprehensive area assessment
area_context = state.get("area_context", {})
services = area_context.get("services_within_1km", {})
transit = area_context.get("transit_access", {})

# Build strength/weakness analysis
strengths = []
weaknesses = []

# Transit
if transit.get("available"):
    closest = transit.get("closest_stop", {})
    if closest.get("distance_m", 999) < 200:
        strengths.append(f"Excellent transit access ({closest.get('distance_m')}m to {closest.get('name')})")
    freq = transit.get("frequency_analysis", {})
    if freq.get("average_frequency_min", 60) < 15:
        strengths.append(f"High transit frequency ({freq.get('description')})")

# Services
if services.get("dining", {}).get("restaurants", 0) > 10:
    strengths.append(f"{services['dining']['restaurants']} restaurants within 1km")

if services.get("education", {}).get("schools", 0) == 0:
    weaknesses.append("No schools within 1km radius")

if services.get("retail", {}).get("supermarkets", 0) == 0:
    weaknesses.append("No supermarkets within 1km - may require car or longer trips for groceries")

# Recreation
parks = area_context.get("recreation", {}).get("parks", 0)
playgrounds = area_context.get("recreation", {}).get("playgrounds", 0)
if parks > 3 or playgrounds > 5:
    strengths.append(f"Green and family-friendly ({parks} parks, {playgrounds} playgrounds)")
```

## Best Practices

1. **Always check for None**: Area context may not be available if location/property designation was not provided
2. **Use .get() with defaults**: Safely access nested data with fallback values
3. **Check data sources**: Use `data_sources` field to understand what data is available
4. **Use the summary**: The `summary` field provides a human-readable overview
5. **Consider data freshness**: OSM and Google Places data may be cached or stale
6. **Handle missing data gracefully**: Not all services may be available in all areas

## Example: Complete Agent Integration

```python
def analyze_market_intelligence(state: AnalysisState) -> Dict[str, Any]:
    """Market Intelligence Agent using area context."""

    area_context = state.get("area_context")

    # Initialize output
    output = {
        "status": "completed",
        "confidence_score": 0.85,
        "output": {
            "summary": "",
            "key_insights": [],
            "area_assessment": {}
        }
    }

    if not area_context:
        output["output"]["summary"] = "Market intelligence analysis completed without area context data"
        return output

    # Extract data
    services = area_context.get("services_within_1km", {})
    transit = area_context.get("transit_access", {})
    location = area_context.get("location", {})

    # Build insights
    insights = []

    # Transit insight
    if transit.get("available"):
        closest = transit.get("closest_stop", {})
        distance = closest.get("distance_m", 999)
        if distance < 300:
            insights.append(
                f"Excellent transit connectivity with {closest.get('name')} "
                f"only {distance}m away, supporting car-free lifestyle"
            )

    # Dining insight
    dining = services.get("dining", {})
    if dining.get("restaurants", 0) > 15:
        top_rated = dining.get("top_rated_restaurant")
        if top_rated:
            insights.append(
                f"Vibrant dining scene with {dining['restaurants']} restaurants, "
                f"including highly-rated {top_rated['name']}"
            )

    # Fitness insight
    fitness = services.get("fitness", {})
    if fitness.get("gyms", 0) > 5:
        insights.append(
            f"Health-conscious area with {fitness['gyms']} gyms nearby"
        )

    # Build area assessment
    area_assessment = {
        "location_name": location.get("name"),
        "municipality": location.get("municipality"),
        "transit_quality": "excellent" if transit.get("closest_stop", {}).get("distance_m", 999) < 300 else "good",
        "amenity_richness": len(insights),
        "target_demographic": "young professionals" if dining.get("restaurants", 0) > 10 else "families"
    }

    # Update output
    output["output"]["key_insights"] = insights
    output["output"]["area_assessment"] = area_assessment
    output["output"]["summary"] = f"Area analysis for {location.get('name')}: {len(insights)} key strengths identified"

    return output
```

## Testing Area Context Integration

```bash
# Test with mock data (includes property designation)
source venv/bin/activate && python main.py --use-mock

# Test with specific property
python area_context_cli.py --property "NACKA KVARNHOLMEN 1:1" --pretty

# Test with location
python area_context_cli.py --location "Kvarnholmen, Nacka" --pretty
```

## Future Enhancements

1. **Lantmäteriet Integration**: When API key is available, exact property coordinates
2. **Travel Times**: Fix Trafiklab travel time endpoint for commute analysis
3. **Historical Data**: Track area development over time
4. **Predictive Models**: Use area context to predict demand
5. **Comparative Analysis**: Compare areas using standardized metrics
