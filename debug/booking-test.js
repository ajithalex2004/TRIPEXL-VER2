// Simple script to test the booking API endpoints
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

// Test the simple connectivity endpoint
async function testApiConnectivity() {
  try {
    console.log('Testing API connectivity...');
    const response = await axios.get(`${API_BASE_URL}/api/bookings/test`);
    console.log('API Connection test successful:');
    console.log(response.data);
    return true;
  } catch (error) {
    console.error('API Connection test failed:');
    console.error(error.message);
    return false;
  }
}

// Sample booking data with UAE location
const sampleBooking = {
  employee_id: 1, // Use a valid employee ID from your database
  booking_type: "passenger",
  purpose: "Hospital Visit",
  priority: "Normal",
  pickup_location: {
    address: "Abu Dhabi Central Bus Station, Abu Dhabi, UAE",
    coordinates: {
      lat: 24.4304,
      lng: 54.4706
    },
    place_id: "ChIJTZ7lc11F-TUR9nHfWw-VJBE",
    name: "Abu Dhabi Central Bus Station",
    formatted_address: "Abu Dhabi Central Bus Station, Abu Dhabi, UAE",
    city: "Abu Dhabi",
    place_types: ["transit_station", "point_of_interest", "establishment"]
  },
  dropoff_location: {
    address: "Al Wahda Mall, Abu Dhabi, UAE",
    coordinates: {
      lat: 24.4294,
      lng: 54.4617
    },
    place_id: "ChIJ_VQxynNF-TURQJwfuoEeoFU",
    name: "Al Wahda Mall",
    formatted_address: "Al Wahda Mall, Abu Dhabi, UAE",
    city: "Abu Dhabi",
    place_types: ["shopping_mall", "point_of_interest", "establishment"]
  },
  pickup_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
  dropoff_time: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 minutes from now
  trip_type: "Round Trip",
  num_passengers: 2,
  with_driver: true,
  booking_for_self: true,
  remarks: "This is a test booking from the API test script"
};

// Test creating a booking
async function testCreateBooking() {
  try {
    console.log('Testing booking creation...');
    console.log('Sample booking data:', JSON.stringify(sampleBooking, null, 2));
    
    const response = await axios.post(`${API_BASE_URL}/api/bookings`, sampleBooking);
    console.log('Booking created successfully:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Booking creation failed:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Status code:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    
    return false;
  }
}

// Run the tests
async function runTests() {
  const apiConnected = await testApiConnectivity();
  
  if (apiConnected) {
    await testCreateBooking();
  } else {
    console.log('Skipping booking test due to API connection issues');
  }
}

// Execute tests
runTests().catch(console.error);