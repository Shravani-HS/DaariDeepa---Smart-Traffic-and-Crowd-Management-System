"""
Crowd Detection Dataset for Bangalore Temples and Malls
Static dataset with gate layouts, peak hours, and crowd patterns
"""

BANGALORE_CROWD_LOCATIONS = {
    "temples": [
        {
            "id": "iskcon_bangalore",
            "name": "ISKCON Temple",
            "type": "temple",
            "lat": 13.0098,
            "lng": 77.5511,
            "address": "Hare Krishna Hill, Chord Road, Rajajinagar",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Gate (West)", "direction": "west", "capacity": 500, "typical_crowd": "high"},
                {"id": "north_gate", "name": "North Entrance", "direction": "north", "capacity": 300, "typical_crowd": "medium"},
                {"id": "south_gate", "name": "South Exit Gate", "direction": "south", "capacity": 200, "typical_crowd": "low"},
                {"id": "parking_gate", "name": "Parking Entrance", "direction": "east", "capacity": 400, "typical_crowd": "medium"}
            ],
            "peak_hours": ["6:00-8:00", "11:00-13:00", "18:00-20:00"],
            "weekly_peak": ["Saturday", "Sunday", "Ekadashi"],
            "total_capacity": 5000
        },
        {
            "id": "dodda_ganesha",
            "name": "Dodda Ganapathi Temple",
            "type": "temple",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "Bull Temple Road, Basavanagudi",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Entrance", "direction": "north", "capacity": 300, "typical_crowd": "high"},
                {"id": "side_gate", "name": "Side Gate", "direction": "east", "capacity": 150, "typical_crowd": "low"}
            ],
            "peak_hours": ["5:30-7:30", "12:00-13:00", "17:00-20:00"],
            "weekly_peak": ["Tuesday", "Friday", "Chaturthi"],
            "total_capacity": 2000
        },
        {
            "id": "bull_temple",
            "name": "Bull Temple (Nandi Temple)",
            "type": "temple",
            "lat": 12.9447,
            "lng": 77.5703,
            "address": "Bull Temple Road, Basavanagudi",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Gate", "direction": "east", "capacity": 400, "typical_crowd": "high"},
                {"id": "back_gate", "name": "Back Entrance", "direction": "west", "capacity": 200, "typical_crowd": "low"}
            ],
            "peak_hours": ["6:00-9:00", "17:00-20:00"],
            "weekly_peak": ["Monday", "Saturday", "Sunday"],
            "total_capacity": 3000
        },
        {
            "id": "chokkanathaswamy",
            "name": "Chokkanathaswamy Temple",
            "type": "temple",
            "lat": 13.0292,
            "lng": 77.5779,
            "address": "Domlur",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Entrance", "direction": "south", "capacity": 250, "typical_crowd": "medium"},
                {"id": "west_gate", "name": "West Gate", "direction": "west", "capacity": 150, "typical_crowd": "low"}
            ],
            "peak_hours": ["6:00-8:00", "18:00-20:00"],
            "weekly_peak": ["Friday", "Sunday"],
            "total_capacity": 1500
        },
        {
            "id": "venkataramana_temple",
            "name": "Venkataramana Temple",
            "type": "temple",
            "lat": 12.9592,
            "lng": 77.5762,
            "address": "Jayanagar 4th Block",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Gate", "direction": "north", "capacity": 350, "typical_crowd": "high"},
                {"id": "east_gate", "name": "East Entrance", "direction": "east", "capacity": 200, "typical_crowd": "medium"},
                {"id": "south_gate", "name": "South Gate", "direction": "south", "capacity": 150, "typical_crowd": "low"}
            ],
            "peak_hours": ["6:00-8:00", "11:00-13:00", "18:00-20:30"],
            "weekly_peak": ["Saturday", "Sunday", "Purnima"],
            "total_capacity": 2500
        },
        {
            "id": "banashankari_temple",
            "name": "Banashankari Temple",
            "type": "temple",
            "lat": 12.9134,
            "lng": 77.5490,
            "address": "Banashankari 2nd Stage",
            "icon": "🛕",
            "gates": [
                {"id": "main_gate", "name": "Main Gopuram Gate", "direction": "east", "capacity": 600, "typical_crowd": "high"},
                {"id": "north_gate", "name": "North Gate", "direction": "north", "capacity": 300, "typical_crowd": "medium"},
                {"id": "south_gate", "name": "South Gate", "direction": "south", "capacity": 300, "typical_crowd": "medium"},
                {"id": "vip_gate", "name": "VIP/Darshan Gate", "direction": "west", "capacity": 200, "typical_crowd": "low"}
            ],
            "peak_hours": ["5:30-8:00", "10:00-13:00", "17:00-21:00"],
            "weekly_peak": ["Friday", "Saturday", "Sunday", "Ashtami"],
            "total_capacity": 8000
        }
    ],
    "malls": [
        {
            "id": "phoenix_marketcity",
            "name": "Phoenix Marketcity",
            "type": "mall",
            "lat": 12.9965,
            "lng": 77.6961,
            "address": "Whitefield Main Road, Mahadevapura",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Gate 1 - Main Entrance", "direction": "south", "capacity": 800, "typical_crowd": "high"},
                {"id": "gate_2", "name": "Gate 2 - Food Court Side", "direction": "north", "capacity": 600, "typical_crowd": "high"},
                {"id": "gate_3", "name": "Gate 3 - Parking A", "direction": "east", "capacity": 500, "typical_crowd": "medium"},
                {"id": "gate_4", "name": "Gate 4 - Parking B", "direction": "west", "capacity": 500, "typical_crowd": "medium"},
                {"id": "gate_5", "name": "Gate 5 - Metro Link", "direction": "north", "capacity": 700, "typical_crowd": "high"}
            ],
            "peak_hours": ["11:00-14:00", "17:00-21:00"],
            "weekly_peak": ["Saturday", "Sunday", "Holidays"],
            "total_capacity": 15000
        },
        {
            "id": "orion_mall",
            "name": "Orion Mall",
            "type": "mall",
            "lat": 13.0108,
            "lng": 77.5540,
            "address": "Rajajinagar, Dr. Rajkumar Road",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Main Gate - East", "direction": "east", "capacity": 700, "typical_crowd": "high"},
                {"id": "gate_2", "name": "West Entrance", "direction": "west", "capacity": 500, "typical_crowd": "medium"},
                {"id": "gate_3", "name": "Multiplex Gate", "direction": "north", "capacity": 400, "typical_crowd": "medium"},
                {"id": "gate_4", "name": "Basement Parking", "direction": "south", "capacity": 600, "typical_crowd": "high"}
            ],
            "peak_hours": ["12:00-15:00", "18:00-21:30"],
            "weekly_peak": ["Friday", "Saturday", "Sunday"],
            "total_capacity": 12000
        },
        {
            "id": "forum_mall",
            "name": "Forum Mall",
            "type": "mall",
            "lat": 12.9344,
            "lng": 77.6101,
            "address": "Hosur Road, Koramangala",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Main Entrance", "direction": "west", "capacity": 600, "typical_crowd": "high"},
                {"id": "gate_2", "name": "PVR Cinema Gate", "direction": "north", "capacity": 400, "typical_crowd": "high"},
                {"id": "gate_3", "name": "Hosur Road Gate", "direction": "south", "capacity": 500, "typical_crowd": "medium"},
                {"id": "gate_4", "name": "Food Street Exit", "direction": "east", "capacity": 300, "typical_crowd": "medium"}
            ],
            "peak_hours": ["11:00-14:00", "17:00-21:00"],
            "weekly_peak": ["Saturday", "Sunday"],
            "total_capacity": 10000
        },
        {
            "id": "ub_city",
            "name": "UB City Mall",
            "type": "mall",
            "lat": 12.9716,
            "lng": 77.5946,
            "address": "UB City, Vittal Mallya Road",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Vittal Mallya Gate", "direction": "east", "capacity": 400, "typical_crowd": "medium"},
                {"id": "gate_2", "name": "Parking Entrance", "direction": "west", "capacity": 300, "typical_crowd": "low"},
                {"id": "gate_3", "name": "Skyview Exit", "direction": "north", "capacity": 200, "typical_crowd": "low"}
            ],
            "peak_hours": ["12:00-15:00", "18:00-21:00"],
            "weekly_peak": ["Friday", "Saturday", "Sunday"],
            "total_capacity": 5000
        },
        {
            "id": "garuda_mall",
            "name": "Garuda Mall",
            "type": "mall",
            "lat": 12.9736,
            "lng": 77.6082,
            "address": "Magrath Road, Ashok Nagar",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Main Gate", "direction": "north", "capacity": 500, "typical_crowd": "high"},
                {"id": "gate_2", "name": "Magrath Road Gate", "direction": "south", "capacity": 400, "typical_crowd": "medium"},
                {"id": "gate_3", "name": "Parking Gate", "direction": "east", "capacity": 300, "typical_crowd": "medium"}
            ],
            "peak_hours": ["11:00-14:00", "17:00-21:00"],
            "weekly_peak": ["Saturday", "Sunday"],
            "total_capacity": 8000
        },
        {
            "id": "nexus_central",
            "name": "Nexus Central Mall",
            "type": "mall",
            "lat": 12.9592,
            "lng": 77.6476,
            "address": "Domlur, Old Airport Road",
            "icon": "🏬",
            "gates": [
                {"id": "gate_1", "name": "Airport Road Gate", "direction": "east", "capacity": 600, "typical_crowd": "high"},
                {"id": "gate_2", "name": "West Entrance", "direction": "west", "capacity": 400, "typical_crowd": "medium"},
                {"id": "gate_3", "name": "Food Court Gate", "direction": "north", "capacity": 350, "typical_crowd": "high"},
                {"id": "gate_4", "name": "BMTC Bus Stop Gate", "direction": "south", "capacity": 450, "typical_crowd": "medium"}
            ],
            "peak_hours": ["12:00-15:00", "18:00-21:00"],
            "weekly_peak": ["Saturday", "Sunday", "Holidays"],
            "total_capacity": 9000
        }
    ]
}

def get_all_locations():
    all_locs = []
    for t in BANGALORE_CROWD_LOCATIONS["temples"]:
        all_locs.append(t)
    for m in BANGALORE_CROWD_LOCATIONS["malls"]:
        all_locs.append(m)
    return all_locs

def get_location_by_id(location_id):
    for loc in get_all_locations():
        if loc["id"] == location_id:
            return loc
    return None
