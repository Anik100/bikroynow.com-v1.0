export const LOCATIONS = {
  Dhaka: ['Dhaka City', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  Chattogram: ['Chattogram City', 'Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', 'Cumilla', 'Cox\'s Bazar', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
  Rajshahi: ['Rajshahi City', 'Bogura', 'Joypurhat', 'Naogaon', 'Natore', 'Chapainawabganj', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Khulna: ['Khulna City', 'Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Barishal: ['Barishal City', 'Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  Sylhet: ['Sylhet City', 'Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  Rangpur: ['Rangpur City', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Mymensingh: ['Mymensingh City', 'Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur']
};

export const LOCATION_ALIASES = {
  'Dhaka': ['dacca', 'ঢাকা'],
  'Dhaka City': ['dacca', 'dhaka', 'ঢাকা সিটি', 'ঢাকা'],
  'Faridpur': ['ফরিদপুর'],
  'Gazipur': ['গাজীপুর'],
  'Gopalganj': ['গোপালগঞ্জ'],
  'Kishoreganj': ['কিশোরগঞ্জ'],
  'Madaripur': ['মাদারীপুর'],
  'Manikganj': ['মানিকগঞ্জ'],
  'Munshiganj': ['মুন্সীগঞ্জ', 'মুন্সিগঞ্জ'],
  'Narayanganj': ['নারায়ণগঞ্জ', 'নারায়ণগঞ্জ'],
  'Narsingdi': ['নরসিংদী'],
  'Rajbari': ['রাজবাড়ী', 'রাজবাড়ী'],
  'Shariatpur': ['শরীয়তপুর', 'শরীয়তপুর'],
  'Tangail': ['টাঙ্গাইল', 'টাংগাইল'],
  'Chattogram': ['chittagong', 'ctg', 'chattagram', 'চট্টগ্রাম', 'চট্রগ্রাম', 'চিটাগং', 'চিটাগাং'],
  'Chattogram City': ['chittagong city', 'chittagong', 'ctg', 'chattagram', 'চট্টগ্রাম সিটি', 'চট্টগ্রাম', 'চট্রগ্রাম', 'চিটাগং', 'চিটাগাং'],
  'Bandarban': ['বান্দরবান'],
  'Brahmanbaria': ['b.baria', 'b baria', 'brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'],
  'Chandpur': ['চাঁদপুর'],
  'Cumilla': ['comilla', 'কুমিল্লা'],
  'Cox\'s Bazar': ['coxs bazar', 'coxsbazar', 'কক্সবাজার'],
  'Feni': ['ফেনী'],
  'Khagrachhari': ['khagrachari', 'খাগড়াছড়ি', 'খাগড়াছড়ি'],
  'Lakshmipur': ['laxmipur', 'লক্ষ্মীপুর'],
  'Noakhali': ['নোয়াখালী', 'নোয়াখালী'],
  'Rangamati': ['রাঙ্গামাটি', 'রাঙামাটি'],
  'Rajshahi': ['রাজশাহী'],
  'Rajshahi City': ['রাজশাহী সিটি', 'রাজশাহী'],
  'Bogura': ['bogra', 'বগুড়া', 'বগুড়া'],
  'Joypurhat': ['jaipurhat', 'জয়পুরহাট', 'জয়পুরহাট'],
  'Naogaon': ['নওগাঁ'],
  'Natore': ['নাটোর'],
  'Chapainawabganj': ['chapai nawabganj', 'nawabganj', 'চাঁপাইনবাবগঞ্জ'],
  'Pabna': ['পাবনা'],
  'Sirajganj': ['সিরাজগঞ্জ'],
  'Khulna': ['খুলনা'],
  'Khulna City': ['খুলনা সিটি', 'খুলনা'],
  'Bagerhat': ['বাগেরহাট'],
  'Chuadanga': ['চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'],
  'Jashore': ['jessore', 'যশোর'],
  'Jhenaidah': ['jhenaida', 'ঝিনাইদহ'],
  'Kushtia': ['কুষ্টিয়া', 'কুষ্টিয়া'],
  'Magura': ['মাগুরা'],
  'Meherpur': ['মেহেরপুর'],
  'Narail': ['নড়াইল', 'নড়াইল'],
  'Satkhira': ['সাতক্ষীরা'],
  'Barishal': ['barisal', 'বরিশাল'],
  'Barishal City': ['barisal city', 'barisal', 'বরিশাল সিটি', 'বরিশাল'],
  'Barguna': ['বরগুনা'],
  'Bhola': ['ভোলা'],
  'Jhalokati': ['jhalakathi', 'jhalakati', 'ঝালকাঠি'],
  'Patuakhali': ['পটুয়াখালী', 'পটুয়াখালী'],
  'Pirojpur': ['পিরোজপুর'],
  'Sylhet': ['সিলেট'],
  'Sylhet City': ['সিলেট সিটি', 'সিলেট'],
  'Habiganj': ['হবিগঞ্জ'],
  'Moulvibazar': ['maulvibazar', 'মৌলভীবাজার'],
  'Sunamganj': ['সুনামগঞ্জ'],
  'Rangpur': ['রংপুর'],
  'Rangpur City': ['রংপুর সিটি', 'রংপুর'],
  'Dinajpur': ['দিনাজপুর'],
  'Gaibandha': ['গাইবান্ধা'],
  'Kurigram': ['কুড়িগ্রাম', 'কুড়িগ্রাম'],
  'Lalmonirhat': ['লালমনিরহাট'],
  'Nilphamari': ['নীলফামারী'],
  'Panchagarh': ['পঞ্চগড়', 'পঞ্চগড়'],
  'Thakurgaon': ['ঠাকুরগাঁও'],
  'Mymensingh': ['ময়মনসিংহ', 'ময়মনসিংহ'],
  'Mymensingh City': ['ময়মনসিংহ সিটি', 'ময়মনসিংহ সিটি', 'ময়মনসিংহ', 'ময়মনসিংহ'],
  'Jamalpur': ['জামালপুর'],
  'Netrokona': ['netrakona', 'নেত্রকোণা', 'নেত্রকোনা'],
  'Sherpur': ['শেরপুর']
};

const CANONICAL_LOCATION_MAP = {
  'comilla': 'Cumilla',
  'bogra': 'Bogura',
  'jessore': 'Jashore',
  'chittagong': 'Chattogram',
  'chittagong city': 'Chattogram City',
  'barisal': 'Barishal',
  'barisal city': 'Barishal City',
  'dacca': 'Dhaka',
  'all of chittagong division': 'All of Chattogram Division',
  'all of barisal division': 'All of Barishal Division'
};

export const normalizeLocationName = (loc) => {
  if (!loc || typeof loc !== 'string') return '';
  const trimmed = loc.trim();
  const mapped = CANONICAL_LOCATION_MAP[trimmed.toLowerCase()];
  return mapped || trimmed;
};

export const matchesLocationQuery = (locationName, query) => {
  if (!locationName || !query) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const canonical = normalizeLocationName(locationName);
  if (canonical.toLowerCase().includes(q) || locationName.toLowerCase().includes(q)) {
    return true;
  }
  const aliases = LOCATION_ALIASES[canonical] || [];
  return aliases.some(alias => alias.toLowerCase().includes(q) || q.includes(alias.toLowerCase()));
};

export const isAdInSelectedLocation = (adLocation, selectedLocation) => {
  if (!selectedLocation || selectedLocation === 'All of Bangladesh') return true;
  const normAdLoc = normalizeLocationName(adLocation);
  const normSelected = normalizeLocationName(selectedLocation);
  const isDivision = Object.keys(LOCATIONS).includes(normSelected);
  const isAllOfDivision = normSelected.startsWith('All of ') && normSelected.endsWith(' Division');
  if (isDivision || isAllOfDivision) {
    const divisionName = isDivision
      ? normSelected
      : normSelected.replace('All of ', '').replace(' Division', '');
    const districtsInDivision = LOCATIONS[divisionName];
    if (districtsInDivision) {
      return normAdLoc === normSelected || normAdLoc === divisionName || districtsInDivision.includes(normAdLoc);
    }
    return normAdLoc === normSelected;
  }
  return normAdLoc === normSelected;
};

export const CATEGORIES = {
  "Mobile Phones": {
    "mobile_phones": {
      brands: ["Samsung", "Apple iPhone", "Xiaomi", "Redmi", "POCO", "Realme", "Vivo", "Oppo", "OnePlus", "Google Pixel", "Infinix", "Tecno", "Motorola", "Honor", "Walton", "Symphony", "Nokia"],
      hasModel: true
    },
    "mobile_parts_components": {
      brands: [
        "ডিসপ্লে / এলসিডি ও ওলেড (Display / LCD)",
        "মাদারবোর্ড (Original Motherboard)",
        "চার্জিং লজিক বোর্ড ও পোর্ট (Charging Logic Board)",
        "ক্যামেরা মডিউল (Front / Back Camera)",
        "ফোন হাউজিং ও বডি কেসিং (Body Housing)",
        "ফোন ব্যাক গ্লাস ও ব্যাক পার্ট (Back Glass / Shell)",
        "ব্যাটারি (Original Replacement Battery)",
        "ড্যামেজ ও পার্টস বিক্রির ডেড ফোন (Dead / Damage Phone)",
        "ফিঙ্গারপ্রিন্ট সেন্সর ও ফ্লেক্স ক্যাবল",
        "স্পিকার ও ইয়ারপিস মডিউল"
      ],
      hasModel: true
    },
    "mobile_accessories": {
      brands: [
        "ফাস্ট চার্জার ও অ্যাডাপ্টার",
        "টাইপ-সি ও লাইটনিং ক্যাবল",
        "পাওয়ার ব্যাংক",
        "হেডফোন, নেকব্যান্ড ও ইয়ারবাড",
        "ব্যাক কভার ও সিলিকন কেস",
        "গ্লাস প্রোটেক্টর ও ইউভি গ্লাস",
        "ক্যামেরা লেন্স প্রটেক্টর",
        "মোবাইল ট্রাইপড ও গিম্বল",
        "মেমোরি কার্ড (MicroSD)"
      ],
      hasModel: false
    },
    "tablets_ipads": {
      brands: ["Apple iPad", "Samsung Galaxy Tab", "Xiaomi Pad", "Lenovo Tab", "Realme Pad", "Huawei MatePad"],
      hasModel: true
    },
    "wearables_gadgets": {
      brands: ["Apple Watch", "Samsung Galaxy Watch", "Amazfit", "Xiaomi / Mi Band", "Huawei", "Kieslect", "Haylou", "Fire-Boltt", "boAt", "Fastrack"],
      hasModel: true
    },
    "sim_services": {
      brands: ["Grameenphone", "Banglalink", "Robi", "Airtel", "Teletalk"],
      hasModel: false
    },
    "other_mobile": {
      brands: ["General", "Other Mobile Item"],
      hasModel: true
    }
  },
  "Electronics": {
    "air_conditioners": {
      brands: ["Gree", "General", "Daikin", "Walton", "Haier", "Carrier", "Midea", "Singer", "Panasonic", "Inverter AC"],
      hasModel: true
    },
    "audio_sound": {
      brands: ["JBL", "Sony", "Bose", "Harman Kardon", "Microlab", "Edifier", "F&D", "Tribit", "Soundbar", "Home Theater"],
      hasModel: true
    },
    "batteries": {
      brands: [
        "18650 Li-ion Cells (2000mAh - 3500mAh)",
        "21700 Li-ion Cells (4000mAh - 5000mAh)",
        "26650 Li-ion High Drain Cells",
        "32140 LiFePO4 Cylindrical Cells (15Ah)",
        "32700 / 33140 LiFePO4 Cells",
        "LiFePO4 (LFP) Prismatic Cells (50Ah - 300Ah)",
        "EVE / CATL Grade-A Cells",
        "Samsung SDI / LG Chem / Panasonic 18650",
        "LiPo (Lithium Polymer) Drone / RC Battery",
        "Custom 1S / 2S / 3S / 4S / 7S Battery Packs",
        "Hamko Tubular IPS Battery (100Ah - 200Ah)",
        "Rahimafrooz Tall Tubular Battery",
        "Lucas / Navana IPS & Solar Battery",
        "Rimso / Eastern / Volta Heavy Battery",
        "12V 7Ah / 9Ah UPS SMF VRLA Battery",
        "LFP Wall-Mounted Solar Home Battery"
      ],
      hasModel: true
    },
    "bms_protection_boards": {
      brands: ["1S / 2S / 3S / 4S BMS", "Daly Smart BMS", "JBD BMS", "Ant BMS", "JK Smart BMS", "Active Balancer Board"],
      hasModel: true
    },
    "cameras_photography": {
      brands: ["Canon", "Nikon", "Sony Mirrorless", "Fujifilm", "GoPro Action Cam", "DJI Camera Drone", "Camera Lens & Tripod"],
      hasModel: true
    },
    "cctv_security_surveillance": {
      brands: ["Hikvision", "Dahua", "Imou", "EZVIZ 360", "V380 Wi-Fi IP Camera", "Tiandy", "DVR / NVR Machine", "Smart Video Doorbell"],
      hasModel: true
    },
    "circuits_diy_modules": {
      brands: ["TP4056 Type-C Charger", "XL4015 Buck Converter", "MT3608 Step-Up Booster", "LM2596 Voltage Regulator", "MOSFET Auto Switch Board", "Digital Voltmeter Ammeter", "Arduino & ESP32"],
      hasModel: true
    },
    "electronic_tools_testers": {
      brands: ["T12 / 936 Soldering Iron", "Quick Hot Air SMD Rework Gun", "Battery Spot Welder Machine", "Digital Multimeter (Aneng, Uni-T)", "ZB2L3 / Li-ion Capacity Tester", "Desoldering Sucker Pump"],
      hasModel: true
    },
    "fans": {
      brands: ["BRB", "Havells", "Walton", "Click", "GFC", "Pak Fan", "Vision", "Rechargeable Emergency Fan"],
      hasModel: false
    },
    "home_appliances": {
      brands: ["Washing Machine", "Steam & Dry Iron", "Water Purifier (RO/UV)", "Geyser & Water Heater", "Vacuum Cleaner", "Insect Killer Lamp"],
      hasModel: true
    },
    "ips_inverters": {
      brands: ["Luminous Pure Sine Wave", "Microtek", "Sukhas", "Rahimafrooz", "Hamko", "Navana", "Mini DC Inverter"],
      hasModel: true
    },
    "kitchen_appliances": {
      brands: ["Microwave & Electric Oven", "Blender & Grinder", "Electric Rice Cooker", "Gas Stove & Infrared Chula", "Induction Cooker", "Air Fryer", "Electric Kettle"],
      hasModel: false
    },
    "lighting_emergency": {
      brands: ["LED Tube & Panel Lights", "Solar Street Lights", "Rechargeable Emergency Lights", "Studio Ring Lights", "Smart RGB LED Strips"],
      hasModel: false
    },
    "power_supplies_adapters": {
      brands: ["12V 5A / 10A / 20A Switching SMPS", "Adjustable Variable DC Bench Supply", "5V / 9V / 12V DC Adapters", "19V Laptop Chargers"],
      hasModel: true
    },
    "refrigerators_freezers": {
      brands: ["Walton", "Singer", "Samsung", "LG", "Haier", "Sharp", "Hitachi", "Deep Freezer", "Mini Bedroom Fridge"],
      hasModel: true
    },
    "solar_panels_accessories": {
      brands: ["Mono PERC Solar Panels", "EPEVER MPPT Controller", "SRNE Solar Controller", "PWM Solar Charge Controller", "Solar Inverter Hybrid", "Solar DC Wires & MC4 Connectors"],
      hasModel: true
    },
    "televisions": {
      brands: ["Sony BRAVIA", "Samsung 4K", "LG OLED / UHD", "Walton Smart TV", "Singer", "TCL", "Xiaomi Mi TV", "Haier", "Android 4K TV Box", "Smart Projector"],
      hasModel: true
    },
    "other_electronics": {
      brands: ["General", "Other Electronic Device"],
      hasModel: true
    }
  },
  "Computers": {
    "laptops": {
      brands: ["Apple MacBook", "HP", "Dell", "Lenovo ThinkPad/IdeaPad", "Asus", "Acer", "MSI", "Walton", "Toshiba"],
      hasModel: true
    },
    "desktop_pcs": {
      brands: ["Custom Built PC", "HP", "Dell", "Lenovo", "Apple Mac Mini/iMac"],
      hasModel: true
    },
    "wifi_routers": {
      brands: ["TP-Link", "Tenda", "Netgear", "D-Link", "MikroTik", "Cisco", "Totolink", "Huawei", "Mercusys", "ZTE", "Xiaomi"],
      hasModel: true
    },
    "onu_fiber_devices": {
      brands: ["V-Sol", "BDCOM", "Huawei", "ZTE", "Realforce", "OptiLink", "Generic ONU"],
      hasModel: true
    },
    "mini_ups_backup": {
      brands: ["WGP", "SKE", "Smart Mini UPS", "Marsriva", "Power Guard", "Custom DIY UPS"],
      hasModel: true
    },
    "modem_pocket_routers": {
      brands: ["ZTE", "Huawei", "TP-Link", "Alcatel", "Olio", "Pocket 4G Router"],
      hasModel: true
    },
    "networking_switches_cables": {
      brands: ["D-Link", "TP-Link", "Cisco", "Tenda", "MikroTik", "Cat6 LAN Cable"],
      hasModel: false
    },
    "computer_parts": {
      brands: ["Intel", "AMD Ryzen", "Nvidia GeForce", "Asus", "Gigabyte", "MSI", "Corsair", "Kingston", "Western Digital", "Samsung"],
      hasModel: true
    },
    "monitors": {
      brands: ["Samsung", "LG", "Dell", "HP", "Asus", "BenQ", "Acer", "ViewSonic", "MSI", "Gigabyte"],
      hasModel: true
    },
    "computer_accessories": {
      brands: ["Logitech", "A4Tech", "Fantech", "Razer", "Havit", "Rapoo", "Corsair"],
      hasModel: false
    },
    "printers_scanners": {
      brands: ["Canon", "Epson", "HP", "Brother", "Pantum"],
      hasModel: true
    },
    "other_computers": {
      brands: ["General", "Other Brand"],
      hasModel: true
    }
  },
  "Vehicles": {
    "cars": {
      brands: ["Toyota", "Honda", "Nissan", "Mitsubishi", "Hyundai", "Kia", "Suzuki", "Mercedes-Benz", "BMW", "Audi"],
      hasModel: true
    },
    "motorcycles": {
      brands: ["Yamaha", "Suzuki", "Honda", "Bajaj", "TVS", "Hero", "Royal Enfield", "KTM", "Lifan", "Runner"],
      hasModel: true
    },
    "bicycles": {
      brands: ["Hero", "Firefox", "Veloce", "Upland", "Ghost", "Trek", "Core", "Duranta", "Phoenix"],
      hasModel: true
    },
    "commercial_vehicles": {
      brands: ["Tata", "Mahindra", "Eicher", "Ashok Leyland", "Hino", "Isuzu"],
      hasModel: true
    },
    "auto_parts_accessories": {
      brands: ["Exide", "Lucas", "Hamko", "Motul", "Mobil", "Shell", "MRF", "CEAT", "Pirelli"],
      hasModel: false
    },
    "other_vehicles": {
      brands: ["General", "Other Brand"],
      hasModel: true
    }
  },
  "Property": {
    "apartments_flats": {
      brands: ["Ready Flat", "Under Construction", "Used Flat", "Studio Apartment", "Sublet Room"],
      hasModel: false
    },
    "land_plots": {
      brands: ["Residential Plot", "Commercial Plot", "Agricultural Land", "Project Plot"],
      hasModel: false
    },
    "commercial_property": {
      brands: ["Office Space", "Shop / Showroom", "Warehouse / Godown", "Factory Floor"],
      hasModel: false
    },
    "houses_buildings": {
      brands: ["Duplex House", "Complete Building", "Single Storied House"],
      hasModel: false
    },
    "other_property": {
      brands: ["General", "Other Property"],
      hasModel: false
    }
  },
  "Jobs": {
    "it_digital": {
      brands: ["Software Developer", "Web Developer", "Graphic Designer", "Video Editor", "Digital Marketer", "SEO Specialist"],
      hasModel: false
    },
    "sales_marketing": {
      brands: ["Field Sales", "Showroom Executive", "Corporate Sales", "Telemarketer"],
      hasModel: false
    },
    "office_admin": {
      brands: ["Office Assistant", "Data Entry Operator", "Accountant", "Receptionist"],
      hasModel: false
    },
    "driver_delivery": {
      brands: ["Delivery Rider", "Private Car Driver", "Truck Driver", "Courier Staff"],
      hasModel: false
    },
    "technical_services": {
      brands: ["Electrician", "AC Mechanic", "Plumber", "Auto Mechanic", "Security Guard"],
      hasModel: false
    },
    "other_jobs": {
      brands: ["General", "Other Job Category"],
      hasModel: false
    }
  },
  "অন্যান্য": {
    "furniture": {
      brands: ["Otobi", "Hatil", "Regal", "Akhtar", "Navana", "Partex", "Local Wooden"],
      hasModel: false
    },
    "fashion": {
      brands: ["Apex", "Bata", "Lotto", "Cat's Eye", "Richman", "Aarong", "Yellow", "Local Brand"],
      hasModel: false
    },
    "sports_fitness": {
      brands: ["Yonex", "Cosco", "Nivia", "Adidas", "Nike", "SS Cricket", "Kookaburra"],
      hasModel: false
    },
    "pets_animals": {
      brands: ["Cats", "Pigeons & Birds", "Aquarium Fish", "Dogs & Puppies", "Cattle & Goats"],
      hasModel: false
    },
    "agriculture_business": {
      brands: ["Seeds & Plants", "Irrigation Pumps", "Packaging Machines", "Industrial Machinery"],
      hasModel: false
    },
    "other_items_general": {
      brands: ["General", "Other Brand"],
      hasModel: true
    }
  }
};

export const CATEGORY_TRANSLATIONS = {
  bn: {
    "Mobile Phones": "মোবাইল ফোন",
    "Computers": "কম্পিউটার ও আইটি",
    "Electronics": "ইলেকট্রনিক্স",
    "Vehicles": "গাড়ি ও যানবাহন",
    "Property": "জমি ও ফ্ল্যাট",
    "Jobs": "চাকরি",
    "অন্যান্য": "অন্যান্য",

    "mobile_phones": "মোবাইল ফোন",
    "mobile_parts_components": "মোবাইল পার্টস ও যন্ত্রাংশ (Display, Motherboard, etc.)",
    "mobile_accessories": "মোবাইল এক্সেসরিজ (Charger, Case, Glass)",
    "tablets_ipads": "ট্যাবলেট ও আইপ্যাড",
    "wearables_gadgets": "ওয়্যারেবেল ও গ্যাজেট",
    "sim_services": "সিম ও সার্ভিস",
    "other_mobile": "অন্যান্য মোবাইল সামগ্রী",

    "air_conditioners": "এয়ার কন্ডিশনার (AC & Cooling)",
    "audio_sound": "অডিও ও সাউন্ড সিস্টেম (Audio & Sound)",
    "batteries": "ব্যাটারি (Batteries - 18650, LiFePO4, IPS)",
    "bms_protection_boards": "বিএমএস প্রটেকশন সার্কিট (BMS Boards)",
    "cameras_photography": "ক্যামেরা, লেন্স ও ড্রোন (Cameras & Drones)",
    "cctv_security_surveillance": "সিসিটিভি ও সিকিউরিটি সিস্টেম (CCTV & Security)",
    "circuits_diy_modules": "সার্কিট ও ডিআইওয়াই মডিউল (Buck/Boost, DIY Modules)",
    "electronic_tools_testers": "টুলস ও টেস্টিং ইকুইপমেন্ট (Tools & Testers)",
    "fans": "ফ্যান ও সিলিং ফ্যান (Fans)",
    "home_appliances": "হোম অ্যাপ্লায়েন্স (Home Appliances)",
    "ips_inverters": "আইপিএস ও ইনভার্টার (IPS & Inverters)",
    "kitchen_appliances": "কিচেন অ্যাপ্লায়েন্স (Kitchen Appliances)",
    "lighting_emergency": "লাইট ও এমার্জেন্সি লাইটিং (Lighting)",
    "power_supplies_adapters": "পাওয়ার সাপ্লাই ও অ্যাডাপ্টার (Power Supplies)",
    "refrigerators_freezers": "রেফ্রিজারেটর ও ডিপ ফ্রিজ (Refrigerators)",
    "solar_panels_accessories": "সোলার প্যানেল ও কন্ট্রোলার (Solar Energy)",
    "televisions": "টেলিভিশন ও টিভি বক্স (Televisions)",
    "other_electronics": "অন্যান্য ইলেকট্রনিক সামগ্রী",

    "laptops": "ল্যাপটপ",
    "desktop_pcs": "ডেস্কটপ পিসি",
    "wifi_routers": "ওয়াইফাই রাউটার",
    "onu_fiber_devices": "ওএনইউ (ONU) ও ফাইবার ডিভাইস",
    "mini_ups_backup": "মিনি ইউপিএস (রাউটার ও ওএনইউ)",
    "modem_pocket_routers": "মডেম ও পকেট রাউটার",
    "networking_switches_cables": "নেটওয়ার্ক সুইচ ও ক্যাবল",
    "computer_parts": "কম্পিউটার পার্টস",
    "monitors": "মনিটর",
    "computer_accessories": "কম্পিউটার এক্সেসরিজ",
    "printers_scanners": "প্রিন্টার ও স্ক্যানার",
    "other_computers": "অন্যান্য কম্পিউটার ও আইটি",

    "cars": "গাড়ি",
    "motorcycles": "মোটরসাইকেল",
    "bicycles": "বাইসাইকেল",
    "commercial_vehicles": "বাণিজ্যিক যানবাহন",
    "auto_parts_accessories": "গাড়ির পার্টস ও এক্সেসরিজ",
    "other_vehicles": "অন্যান্য যানবাহন",

    "apartments_flats": "ফ্ল্যাট ও অ্যাপার্টমেন্ট",
    "land_plots": "জমি ও প্লট",
    "commercial_property": "বাণিজ্যিক স্পেস",
    "houses_buildings": "সম্পূর্ণ বাড়ি",
    "other_property": "অন্যান্য প্রপার্টি",

    "it_digital": "আইটি ও ডিজিটাল",
    "sales_marketing": "সেলস ও মার্কেটিং",
    "office_admin": "অফিস ও প্রশাসন",
    "driver_delivery": "ড্রাইভার ও ডেলিভারি",
    "technical_services": "কারিগরি ও সেবা",
    "other_jobs": "অন্যান্য চাকরি",

    "furniture": "ফার্নিচার",
    "fashion": "ফ্যাশন",
    "sports_fitness": "খেলাধুলা ও জিম",
    "pets_animals": "পোষা প্রাণী",
    "agriculture_business": "কৃষি ও ব্যবসা",
    "other_items_general": "বিবিধ / অন্যান্য পণ্য"
  },
  en: {
    "Mobile Phones": "Mobile Phones",
    "Computers": "Computers & IT",
    "Electronics": "Electronics",
    "Vehicles": "Vehicles",
    "Property": "Property",
    "Jobs": "Jobs",
    "অন্যান্য": "Others",

    "mobile_phones": "Mobile Phones",
    "mobile_parts_components": "Mobile Parts & Components (Display, Motherboard, etc.)",
    "mobile_accessories": "Mobile Accessories (Charger, Case, Glass)",
    "tablets_ipads": "Tablets & iPads",
    "wearables_gadgets": "Wearables & Gadgets",
    "sim_services": "SIM & Services",
    "other_mobile": "Other Mobile Items",

    "air_conditioners": "Air Conditioners (AC & Cooling)",
    "audio_sound": "Audio & Sound Systems",
    "batteries": "Batteries (18650, LiFePO4, IPS, etc.)",
    "bms_protection_boards": "BMS Protection Boards",
    "cameras_photography": "Cameras, Lenses & Drones",
    "cctv_security_surveillance": "CCTV & Security Systems",
    "circuits_diy_modules": "Circuits & DIY Modules (Buck/Boost, Modules)",
    "electronic_tools_testers": "Electronic Tools & Testers",
    "fans": "Fans & Air Coolers",
    "home_appliances": "Home Appliances",
    "ips_inverters": "IPS & Inverters",
    "kitchen_appliances": "Kitchen Appliances",
    "lighting_emergency": "Lighting & Emergency Lights",
    "power_supplies_adapters": "Power Supplies & Adapters",
    "refrigerators_freezers": "Refrigerators & Freezers",
    "solar_panels_accessories": "Solar Panels & Controllers",
    "televisions": "Televisions & TV Boxes",
    "other_electronics": "Other Electronics",

    "laptops": "Laptops",
    "desktop_pcs": "Desktop PCs",
    "wifi_routers": "Wi-Fi Routers",
    "onu_fiber_devices": "ONU & Fiber Devices",
    "mini_ups_backup": "Mini UPS (Router & ONU Backup)",
    "modem_pocket_routers": "Modem & Pocket Routers",
    "networking_switches_cables": "Network Switches & Cables",
    "computer_parts": "Computer Components",
    "monitors": "Monitors",
    "computer_accessories": "Computer Accessories",
    "printers_scanners": "Printers & Scanners",
    "other_computers": "Other Computer Items",

    "cars": "Cars",
    "motorcycles": "Motorcycles",
    "bicycles": "Bicycles",
    "commercial_vehicles": "Commercial Vehicles",
    "auto_parts_accessories": "Auto Parts & Accessories",
    "other_vehicles": "Other Vehicles",

    "apartments_flats": "Apartments & Flats",
    "land_plots": "Land & Plots",
    "commercial_property": "Commercial Property",
    "houses_buildings": "Houses & Buildings",
    "other_property": "Other Property",

    "it_digital": "IT & Software",
    "sales_marketing": "Sales & Marketing",
    "office_admin": "Office & Admin",
    "driver_delivery": "Driver & Delivery",
    "technical_services": "Technical & Trade Services",
    "other_jobs": "Other Jobs",

    "furniture": "Furniture",
    "fashion": "Fashion & Lifestyle",
    "sports_fitness": "Sports & Fitness",
    "pets_animals": "Pets & Animals",
    "agriculture_business": "Agriculture & Business",
    "other_items_general": "Miscellaneous Items"
  }
};

export const getCategoryName = (key, lang = 'bn') => {
  return CATEGORY_TRANSLATIONS[lang]?.[key] || CATEGORY_TRANSLATIONS['en']?.[key] || key;
};

export const TRANSLATIONS = {
  en: {
    searchPlaceholder: 'What are you looking for?',
    postAd: 'POST YOUR AD',
    chat: 'Chat',
    account: 'Account',
    login: 'Login',
    home: 'Home',
    messages: 'Messages',
    post: 'Post',
    profile: 'Profile',
    adminPanel: 'Admin Panel',
    allLocations: 'All of Bangladesh',
    selectLocation: 'Select Location',
    selectCategory: 'Select Category',
    browseCategories: 'Browse Categories',
    freshRecommendations: 'Fresh recommendations',
    loadMore: 'Load More',
    noAds: 'No ads found. Be the first to post!',
    title: 'Title',
    category: 'Category',
    mainCategory: 'Main Category',
    subCategory: 'Sub Category',
    itemType: 'Specific Item Type',
    condition: 'Condition',
    price: 'Price (Tk)',
    location: 'Location',
    division: 'Division',
    district: 'District / Area',
    description: 'Description',
    photos: 'Photos (Up to 5)',
    contactPhone: 'Contact Phone Number',
    postingAd: 'Posting Ad...',
    postAdSubmit: 'Post Ad',
    new: 'New',
    used: 'Used',
    productName: 'Product Name',
    addImages: 'Add Images',
    cover: 'Cover',
    priceBdt: 'Price (BDT)',
    phoneNumber: 'Phone Number',
    selectDivision: 'Select Division',
    selectDistrict: 'Select District',
    processing: 'Processing...'
  },
  bn: {
    searchPlaceholder: 'আপনি কি খুঁজছেন?',
    postAd: 'বিজ্ঞাপন দিন',
    chat: 'চ্যাট',
    account: 'অ্যাকাউন্ট',
    login: 'লগইন',
    home: 'হোম',
    messages: 'মেসেজ',
    post: 'পোস্ট',
    profile: 'প্রোফাইল',
    adminPanel: 'অ্যাডমিন প্যানেল',
    allLocations: 'সমগ্র বাংলাদেশ',
    selectLocation: 'অবস্থান নির্বাচন করুন',
    selectCategory: 'ক্যাটাগরি নির্বাচন করুন',
    browseCategories: 'ক্যাটাগরি ব্রাউজ করুন',
    freshRecommendations: 'নতুন বিজ্ঞাপনসমূহ',
    loadMore: 'আরও দেখুন',
    noAds: 'কোনো বিজ্ঞাপন পাওয়া যায়নি। প্রথম বিজ্ঞাপনটি দিন!',
    title: 'শিরোনাম',
    category: 'ক্যাটাগরি',
    mainCategory: 'মূল ক্যাটাগরি',
    subCategory: 'উপ-ক্যাটাগরি',
    itemType: 'আইটেমের ধরন',
    condition: 'অবস্থা',
    price: 'দাম (টাকা)',
    location: 'অবস্থান',
    division: 'বিভাগ',
    district: 'জেলা / অঞ্চল',
    description: 'বিবরণ',
    photos: 'ছবি (৫টি পর্যন্ত)',
    contactPhone: 'যোগাযোগের ফোন নাম্বার',
    postingAd: 'বিজ্ঞাপন পোস্ট হচ্ছে...',
    postAdSubmit: 'বিজ্ঞাপন পোস্ট করুন',
    new: 'নতুন',
    used: 'ব্যবহৃত',
    productName: 'পণ্যের নাম',
    addImages: 'ছবি যোগ করুন',
    cover: 'কভার',
    priceBdt: 'মূল্য (টাকা)',
    phoneNumber: 'ফোন নম্বর',
    selectDivision: 'বিভাগ নির্বাচন করুন',
    selectDistrict: 'জেলা নির্বাচন করুন',
    processing: 'প্রসেসিং হচ্ছে...'
  }
};
