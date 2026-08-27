"""
Peak Hour Demand Prediction Model
Predicts ticket demand patterns based on time, day, and event characteristics
"""


class PeakHourDetector:
    """
    Predicts peak hours and demand patterns for ticket sales
    """

    def __init__(self):
        # Hourly demand multipliers (0-23 hours)
        self.hourly_multipliers = {
            0: 0.15,  # Midnight - very low
            1: 0.12,  # 1 AM - lowest
            2: 0.10,  # 2 AM - lowest
            3: 0.12,  # 3 AM
            4: 0.15,  # 4 AM
            5: 0.20,  # 5 AM - early morning
            6: 0.30,  # 6 AM - morning starts
            7: 0.50,  # 7 AM
            8: 0.70,  # 8 AM
            9: 1.1,  # 9 AM - morning peak
            10: 1.4,  # 10 AM - morning peak HIGH
            11: 1.5,  # 11 AM - morning peak HIGH
            12: 1.0,  # Noon - lunch dip
            13: 0.9,  # 1 PM
            14: 1.0,  # 2 PM
            15: 1.1,  # 3 PM - afternoon rise
            16: 1.3,  # 4 PM
            17: 1.4,  # 5 PM - evening peak HIGH
            18: 1.3,  # 6 PM
            19: 1.5,  # 7 PM - evening peak HIGHEST
            20: 1.4,  # 8 PM
            21: 1.1,  # 9 PM - late evening
            22: 0.60,  # 10 PM - night drop
            23: 0.30,  # 11 PM - late night
        }

        # Weekly demand multipliers (0=Mon, 6=Sun)
        self.weekly_multipliers = {
            0: 0.9,  # Monday - slight dip
            1: 1.0,  # Tuesday - normal
            2: 1.1,  # Wednesday - slight rise
            3: 1.2,  # Thursday - rise
            4: 1.3,  # Friday - HIGH (weekend starts)
            5: 1.2,  # Saturday - HIGH
            6: 1.0,  # Sunday - back to normal
        }

        # Category demand multipliers
        self.category_multipliers = {
            "concert": 1.5,  # High demand
            "sports": 1.4,  # High demand
            "festival": 1.3,  # Medium-high
            "theater": 1.1,  # Medium
            "conference": 0.8,  # Lower demand
        }

        # Event lifecycle multipliers (days from start)
        self.lifecycle_multipliers = {
            "pre_release": {
                "start": -30,
                "end": -7,
                "multiplier": 2.0,  # Anticipation
            },
            "early_sales": {
                "start": -6,
                "end": -1,
                "multiplier": 0.8,  # Early birds buy, but not many
            },
            "active": {
                "start": 0,
                "end": 7,
                "multiplier": 1.3,  # Active sales period
            },
            "last_minute": {
                "start": 8,
                "end": 0,  # Day of event
                "multiplier": 2.0,  # Last minute rush
            },
        }

        self.model_info = {
            "model_type": "Peak Hour Demand Predictor",
            "version": "1.0",
            "trained": True,
            "peak_hours": [10, 11, 17, 19],  # 10-11 AM, 5 PM, 7 PM
            "off_peak_hours": list(range(0, 6))
            + list(range(22, 24)),  # Midnight to 6 AM, 10 PM onwards
        }

    def predict_peak_hours(self):
        """
        Get overall peak hours and demand distribution

        Returns:
            dict with peak hours, off-peak hours, and hourly multipliers
        """

        hours = list(range(24))
        peak_threshold = 1.3  # Hours with multiplier > 1.3 are "peak"

        peak_hours = [h for h in hours if self.hourly_multipliers[h] > peak_threshold]
        off_peak_hours = [h for h in hours if self.hourly_multipliers[h] < 0.3]
        moderate_hours = [
            h for h in hours if h not in peak_hours and h not in off_peak_hours
        ]

        return {
            "peak_hours": peak_hours,
            "off_peak_hours": off_peak_hours,
            "moderate_hours": moderate_hours,
            "hourly_demand": self.hourly_multipliers,
            "best_hours": sorted(
                peak_hours, key=lambda h: self.hourly_multipliers[h], reverse=True
            )[:3],
            "worst_hours": sorted(
                off_peak_hours, key=lambda h: self.hourly_multipliers[h]
            )[:3],
        }

    def predict_demand_for_event(self, event_data):
        """
        Predict demand multiplier for a specific event

        Args:
            event_data: dict with keys:
                - category: event category (concert, sports, festival, theater, conference)
                - days_until_event: days from now to event
                - event_popularity: 0-10 scale of popularity
                - time_of_day: hour of day (0-23)
                - day_of_week: day of week (0-6, 0=Monday)

        Returns:
            dict with demand prediction
        """

        category = event_data.get("category", "theater").lower()
        days_until = event_data.get("days_until_event", 30)
        popularity = event_data.get("event_popularity", 5) / 10.0  # Normalize 0-1
        time_of_day = event_data.get("time_of_day", 19)
        day_of_week = event_data.get("day_of_week", 4)  # Friday default

        # Base multiplier from hourly pattern
        hourly_mult = self.hourly_multipliers.get(time_of_day, 1.0)

        # Weekly pattern multiplier
        weekly_mult = self.weekly_multipliers.get(day_of_week, 1.0)

        # Category multiplier
        category_mult = self.category_multipliers.get(category, 1.0)

        # Popularity boost (popular events get extra demand)
        popularity_boost = 1.0 + (popularity * 0.3)

        # Lifecycle multiplier
        lifecycle_mult = self.get_lifecycle_multiplier(days_until)

        # Combine all factors
        final_multiplier = (
            hourly_mult
            * weekly_mult
            * category_mult
            * popularity_boost
            * lifecycle_mult
        )

        # Demand level classification
        if final_multiplier > 1.8:
            demand_level = "very_high"
        elif final_multiplier > 1.4:
            demand_level = "high"
        elif final_multiplier > 0.8:
            demand_level = "normal"
        elif final_multiplier > 0.4:
            demand_level = "low"
        else:
            demand_level = "very_low"

        return {
            "demand_multiplier": round(final_multiplier, 2),
            "demand_level": demand_level,
            "hourly_factor": round(hourly_mult, 2),
            "weekly_factor": round(weekly_mult, 2),
            "category_factor": round(category_mult, 2),
            "popularity_factor": round(popularity_boost, 2),
            "lifecycle_factor": round(lifecycle_mult, 2),
            "estimated_concurrent_buyers": int(final_multiplier * 100),
            "recommendation": self.get_pricing_recommendation(
                final_multiplier, demand_level
            ),
        }

    def get_daily_demand_factor(self, date_obj):
        """
        Get demand factor for a specific date

        Args:
            date_obj: datetime object

        Returns:
            float: demand multiplier for that day
        """
        day_of_week = date_obj.weekday()
        return self.weekly_multipliers.get(day_of_week, 1.0)

    def get_lifecycle_multiplier(self, days_until_event):
        """
        Get lifecycle stage multiplier based on days until event

        Args:
            days_until_event: days from now until event date

        Returns:
            float: lifecycle multiplier
        """

        if days_until_event >= -30 and days_until_event <= -7:
            return 2.0  # Pre-release hype
        elif days_until_event >= -6 and days_until_event <= -1:
            return 0.8  # Early bird period
        elif days_until_event >= 0 and days_until_event <= 7:
            return 1.3  # Active booking period
        elif days_until_event >= 8:
            return 2.0  # Last minute rush
        else:
            return 1.0  # Default

    def get_pricing_recommendation(self, multiplier, demand_level):
        """
        Get pricing recommendation based on demand

        Args:
            multiplier: demand multiplier
            demand_level: current demand classification

        Returns:
            str: pricing recommendation
        """

        recommendations = {
            "very_high": "Increase price 35-50%: Very high demand",
            "high": "Increase price 20-30%: High demand",
            "normal": "Keep base price: Normal demand",
            "low": "Discount 10-20%: Low demand",
            "very_low": "Discount 30-40%: Very low demand",
        }

        return recommendations.get(demand_level, "Standard pricing")

    def get_model_info(self):
        """Return model information"""
        return self.model_info


# Initialize globally
peak_hour_detector = PeakHourDetector()


def detect_peak_hours():
    """Convenience function to get peak hours"""
    return peak_hour_detector.predict_peak_hours()


def predict_event_demand(event_data):
    """Convenience function to predict demand for an event"""
    return peak_hour_detector.predict_demand_for_event(event_data)
