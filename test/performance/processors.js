/**
 * Artillery processors for load testing
 */

module.exports = {
  generateToken,
};

function generateToken(context, events, done) {
  // Generate a mock JWT token for testing
  // In real scenario, you'd call the auth endpoint
  context.vars.token = 'mock-jwt-token-for-testing';
  return done();
}
