/**
 * Performance Load Testing
 * Using Artillery for HTTP load testing
 * 
 * Install: npm install -g artillery
 * Run: artillery run test/performance/load-test.yml
 */

module.exports = {
  config: {
    target: process.env.API_URL || 'http://localhost:3000',
    phases: [
      {
        duration: 60,
        arrivalRate: 5, // 5 users per second
        name: 'Warm up',
      },
      {
        duration: 120,
        arrivalRate: 10, // 10 users per second
        name: 'Ramp up',
      },
      {
        duration: 180,
        arrivalRate: 20, // 20 users per second
        name: 'Sustained load',
      },
      {
        duration: 60,
        arrivalRate: 5, // 5 users per second
        name: 'Cool down',
      },
    ],
    defaults: {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  },
  scenarios: [
    {
      name: 'Health check',
      flow: [
        {
          get: {
            url: '/health',
          },
        },
      ],
    },
    {
      name: 'Get employees',
      flow: [
        {
          function: 'generateToken',
        },
        {
          get: {
            url: '/api/v1/employees',
            headers: {
              Authorization: 'Bearer {{ token }}',
            },
          },
        },
      ],
    },
    {
      name: 'Get payruns',
      flow: [
        {
          function: 'generateToken',
        },
        {
          get: {
            url: '/api/v1/payruns',
            headers: {
              Authorization: 'Bearer {{ token }}',
            },
          },
        },
      ],
    },
  ],
  processor: './test/performance/processors.js',
};
