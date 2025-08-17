const { faker } = require('@faker-js/faker');

// Test configuration and shared state
const testConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testUsers: [],
  authenticatedTokens: new Map(),
};

// Generate Indian phone numbers
function generateIndianPhoneNumber() {
  const operators = ['987', '988', '989', '990', '991', '992', '993', '994', '995', '996'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `+91${operator}${number}`;
}

// Generate realistic Indian names
function generateIndianName() {
  const firstNames = [
    'Rajesh', 'Priya', 'Suresh', 'Meera', 'Ganesh', 'Lakshmi', 'Ravi', 'Sita',
    'Kumar', 'Sunita', 'Mahesh', 'Deepika', 'Arun', 'Kavya', 'Vijay', 'Pooja',
    'Ramesh', 'Anita', 'Prakash', 'Geeta', 'Santosh', 'Rekha', 'Dinesh', 'Usha'
  ];
  
  const lastNames = [
    'Kumar', 'Sharma', 'Patel', 'Reddy', 'Nair', 'Rao', 'Singh', 'Devi',
    'Gupta', 'Agarwal', 'Jain', 'Verma', 'Mishra', 'Tiwari', 'Yadav', 'Pandey'
  ];

  return {
    firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)]
  };
}

// Generate Karnataka-specific locations
function generateKarnatakaLocation() {
  const locations = [
    { city: 'Bangalore', pincode: '560001', lat: 12.9716, lng: 77.5946 },
    { city: 'Mysore', pincode: '570001', lat: 12.2958, lng: 76.6394 },
    { city: 'Hubli', pincode: '580020', lat: 15.3647, lng: 75.1240 },
    { city: 'Mangalore', pincode: '575001', lat: 12.9141, lng: 74.8560 },
    { city: 'Belgaum', pincode: '590001', lat: 15.8497, lng: 74.4977 },
    { city: 'Davangere', pincode: '577001', lat: 14.4644, lng: 75.9220 },
    { city: 'Bellary', pincode: '583101', lat: 15.1394, lng: 76.9214 },
    { city: 'Bijapur', pincode: '586101', lat: 16.8302, lng: 75.7100 },
    { city: 'Shimoga', pincode: '577201', lat: 13.9299, lng: 75.5681 },
    { city: 'Tumkur', pincode: '572101', lat: 13.3379, lng: 77.1022 }
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}

// Generate farm-related data
function generateFarmData() {
  const farmTypes = ['Organic Farm', 'Traditional Farm', 'Modern Farm', 'Cooperative Farm'];
  const crops = ['Rice', 'Wheat', 'Sugarcane', 'Cotton', 'Maize', 'Jowar', 'Bajra', 'Ragi'];
  const soilTypes = ['LOAMY', 'CLAY', 'SANDY', 'BLACK', 'RED'];
  const irrigationTypes = ['DRIP', 'SPRINKLER', 'FLOOD', 'FURROW'];
  
  const location = generateKarnatakaLocation();
  
  return {
    name: `${farmTypes[Math.floor(Math.random() * farmTypes.length)]} - ${location.city}`,
    totalArea: (Math.random() * 10 + 0.5).toFixed(2),
    soilType: soilTypes[Math.floor(Math.random() * soilTypes.length)],
    irrigationType: irrigationTypes[Math.floor(Math.random() * irrigationTypes.length)],
    mainCrop: crops[Math.floor(Math.random() * crops.length)],
    location: location,
    coordinates: {
      lat: location.lat + (Math.random() - 0.5) * 0.1, // Add some variance
      lng: location.lng + (Math.random() - 0.5) * 0.1
    }
  };
}

// Custom Artillery processor functions
module.exports = {
  // Set custom variables before scenarios
  setCustomVariables: function(requestParams, context, ee, next) {
    const name = generateIndianName();
    const location = generateKarnatakaLocation();
    const farmData = generateFarmData();
    
    context.vars.phoneNumber = generateIndianPhoneNumber();
    context.vars.firstName = name.firstName;
    context.vars.lastName = name.lastName;
    context.vars.email = `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@example.com`;
    context.vars.city = location.city;
    context.vars.pincode = location.pincode;
    context.vars.address = `${Math.floor(Math.random() * 999) + 1}, ${location.city} Rural`;
    context.vars.farmName = farmData.name;
    context.vars.farmArea = farmData.totalArea;
    context.vars.soilType = farmData.soilType;
    context.vars.irrigationType = farmData.irrigationType;
    context.vars.latitude = farmData.coordinates.lat;
    context.vars.longitude = farmData.coordinates.lng;
    
    return next();
  },

  // Generate mock OTP for testing
  generateMockOtp: function(requestParams, context, ee, next) {
    // In real testing, this would need to be retrieved from database
    // For load testing, we use a predictable OTP
    context.vars.mockOtp = '123456';
    return next();
  },

  // Authenticate user and store token
  authenticateUser: async function(requestParams, context, ee, next) {
    const phoneNumber = generateIndianPhoneNumber();
    
    // Check if we already have a token for this user
    if (testConfig.authenticatedTokens.has(phoneNumber)) {
      context.vars.accessToken = testConfig.authenticatedTokens.get(phoneNumber);
      return next();
    }

    try {
      // Register user
      const registerResponse = await fetch(`${testConfig.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          password: 'StrongPassword123!',
          firstName: context.vars.firstName || 'Test',
          lastName: context.vars.lastName || 'User',
          role: 'FARMER'
        })
      });

      if (!registerResponse.ok) {
        // User might already exist, try to login
        const loginResponse = await fetch(`${testConfig.baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phoneNumber,
            password: 'StrongPassword123!'
          })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          context.vars.accessToken = loginData.accessToken;
          testConfig.authenticatedTokens.set(phoneNumber, loginData.accessToken);
        }
        return next();
      }

      const registerData = await registerResponse.json();
      
      // Mock OTP verification for load testing
      const verifyResponse = await fetch(`${testConfig.baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: registerData.userId,
          otp: '123456' // Mock OTP for testing
        })
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        context.vars.accessToken = verifyData.accessToken;
        testConfig.authenticatedTokens.set(phoneNumber, verifyData.accessToken);
      }

    } catch (error) {
      console.error('Authentication error:', error);
      // Continue with test even if auth fails
    }

    return next();
  },

  // Generate crop cultivation data
  generateCropData: function(requestParams, context, ee, next) {
    const crops = [
      { name: 'Rice', varieties: ['Basmati', 'Sona Masuri', 'IR-64', 'Pusa'] },
      { name: 'Wheat', varieties: ['HD-2967', 'PBW-343', 'DBW-17', 'WH-542'] },
      { name: 'Cotton', varieties: ['Bt Cotton', 'Desi Cotton', 'American Cotton'] },
      { name: 'Sugarcane', varieties: ['Co-86032', 'CoM-0265', 'Co-238', 'Co-775'] },
      { name: 'Maize', varieties: ['Pioneer', 'DeKalb', 'Syngenta', 'Monsanto'] }
    ];

    const crop = crops[Math.floor(Math.random() * crops.length)];
    const variety = crop.varieties[Math.floor(Math.random() * crop.varieties.length)];
    
    const today = new Date();
    const plantingDate = new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const harvestDate = new Date(plantingDate.getTime() + (90 + Math.random() * 90) * 24 * 60 * 60 * 1000);

    context.vars.cropName = crop.name;
    context.vars.cropVariety = variety;
    context.vars.plantingDate = plantingDate.toISOString().split('T')[0];
    context.vars.harvestDate = harvestDate.toISOString().split('T')[0];
    context.vars.cultivationArea = (Math.random() * 5 + 0.5).toFixed(2);

    return next();
  },

  // Generate market price data
  generateMarketData: function(requestParams, context, ee, next) {
    const markets = [
      'APMC Bangalore', 'APMC Mysore', 'APMC Hubli', 'APMC Belgaum',
      'Mandya Market', 'Hassan Market', 'Chitradurga Market', 'Raichur Market'
    ];

    const crops = ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Maize', 'Jowar', 'Bajra', 'Ragi'];
    
    context.vars.marketName = markets[Math.floor(Math.random() * markets.length)];
    context.vars.cropForPrice = crops[Math.floor(Math.random() * crops.length)];
    context.vars.pricePerKg = (Math.random() * 100 + 10).toFixed(2);
    context.vars.quantity = Math.floor(Math.random() * 1000 + 100);

    return next();
  },

  // Log performance metrics
  logMetrics: function(requestParams, context, ee, next) {
    const now = Date.now();
    if (!context.vars.startTime) {
      context.vars.startTime = now;
    }

    // Log every 100 requests
    if (context.vars.requestCount && context.vars.requestCount % 100 === 0) {
      const duration = now - context.vars.startTime;
      const rps = (context.vars.requestCount / duration) * 1000;
      console.log(`Performance: ${context.vars.requestCount} requests in ${duration}ms (${rps.toFixed(2)} RPS)`);
    }

    context.vars.requestCount = (context.vars.requestCount || 0) + 1;
    return next();
  },

  // Simulate user think time based on scenario
  simulateThinkTime: function(requestParams, context, ee, next) {
    const scenarios = {
      'authentication': { min: 1000, max: 3000 },
      'profile_update': { min: 2000, max: 5000 },
      'farm_management': { min: 1000, max: 4000 },
      'crop_browsing': { min: 500, max: 2000 },
      'market_check': { min: 1000, max: 3000 }
    };

    const scenario = context.vars.scenario || 'default';
    const thinkTime = scenarios[scenario] || { min: 1000, max: 3000 };
    
    const delay = Math.floor(Math.random() * (thinkTime.max - thinkTime.min) + thinkTime.min);
    
    setTimeout(() => {
      return next();
    }, delay);
  },

  // Clean up resources after test
  cleanup: function(requestParams, context, ee, next) {
    // Clear authentication tokens periodically to prevent memory leaks
    if (testConfig.authenticatedTokens.size > 1000) {
      testConfig.authenticatedTokens.clear();
    }
    return next();
  }
};

// Additional utility functions for complex scenarios
module.exports.utils = {
  // Generate realistic farm boundaries
  generateFarmBoundaries: function(centerLat, centerLng, areaInAcres) {
    const metersPerAcre = 4047;
    const radius = Math.sqrt(areaInAcres * metersPerAcre / Math.PI);
    const radiusInDegrees = radius / 111320; // Approximate meters to degrees conversion

    const points = [];
    const numPoints = 8; // Octagon for simplicity

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = centerLat + radiusInDegrees * Math.cos(angle);
      const lng = centerLng + radiusInDegrees * Math.sin(angle);
      points.push([lng, lat]);
    }
    
    // Close the polygon
    points.push(points[0]);

    return {
      type: 'Polygon',
      coordinates: [points]
    };
  },

  // Generate realistic cultivation activities
  generateCultivationActivities: function() {
    const activities = [
      { type: 'LAND_PREPARATION', name: 'Plowing', duration: 2 },
      { type: 'SEEDING', name: 'Sowing Seeds', duration: 1 },
      { type: 'FERTILIZER', name: 'Fertilizer Application', duration: 1 },
      { type: 'IRRIGATION', name: 'Watering', duration: 1 },
      { type: 'PEST_CONTROL', name: 'Pesticide Spray', duration: 1 },
      { type: 'WEEDING', name: 'Weed Removal', duration: 2 },
      { type: 'HARVESTING', name: 'Crop Harvesting', duration: 3 }
    ];

    return activities[Math.floor(Math.random() * activities.length)];
  },

  // Generate weather-appropriate crop recommendations
  generateWeatherBasedRecommendations: function(season) {
    const seasonalCrops = {
      'KHARIF': ['Rice', 'Cotton', 'Sugarcane', 'Maize', 'Jowar'],
      'RABI': ['Wheat', 'Barley', 'Gram', 'Peas', 'Mustard'],
      'ZAID': ['Watermelon', 'Muskmelon', 'Cucumber', 'Fodder crops']
    };

    const crops = seasonalCrops[season] || seasonalCrops.KHARIF;
    return crops[Math.floor(Math.random() * crops.length)];
  }
};

// Export for use in Artillery scenarios
module.exports.config = testConfig;