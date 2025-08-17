# Hasiru Mitra AI Platform - Comprehensive Testing Guide

## Overview

This document provides comprehensive guidance for testing the Hasiru Mitra AI Platform backend. Our testing strategy ensures quality, reliability, and performance for supporting 200,000+ farmers as specified in the DPR requirements.

## Testing Architecture

### Test Types

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - API endpoint and database integration
3. **End-to-End Tests** - Complete user journey testing
4. **Performance Tests** - Load and stress testing
5. **Database Tests** - Repository and entity testing

### Test Organization

```
test/
├── setup.ts                          # Global test configuration
├── jest-results-processor.js         # Custom test results processing
├── run-all-tests.sh                 # Comprehensive test runner
├── auth.controller.integration.spec.ts   # Auth API integration tests
├── users.controller.integration.spec.ts  # Users API integration tests
├── e2e/
│   └── farmer-journey.e2e.spec.ts   # Complete farmer workflow
├── performance/
│   ├── load-test.yml                # Artillery load test config
│   └── test-helpers.js              # Performance test utilities
└── reports/                         # Generated test reports
```

## Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- Bun package manager
- Docker (optional, for integration tests)
- PostgreSQL (for full integration tests)

### Installation

```bash
# Install dependencies
bun install

# Set up test environment
cp .env.example .env.test
```

### Running Tests

```bash
# Run all tests with comprehensive reporting
./test/run-all-tests.sh

# Run specific test types
bun run test:unit          # Unit tests only
bun run test:integration   # Integration tests
bun run test:e2e          # End-to-end tests
bun run test:performance  # Load/performance tests

# Development testing
bun run test:watch        # Watch mode for development
bun run test:debug        # Debug mode
```

## Test Types Detailed

### 1. Unit Tests

**Location**: `src/**/*.spec.ts`

**Purpose**: Test individual services, controllers, and utility functions in isolation.

**Key Features**:
- Mock external dependencies
- Test business logic
- Validate error handling
- Ensure code coverage

**Examples**:
```typescript
// AuthService unit tests
describe('AuthService', () => {
  it('should register new user successfully', async () => {
    // Test registration logic
  });
  
  it('should validate password strength', () => {
    // Test password validation
  });
});
```

**Run Commands**:
```bash
bun run test:unit                    # All unit tests
bun run test:unit --coverage        # With coverage
bun run test:unit auth.service       # Specific service
```

### 2. Integration Tests

**Location**: `test/*.integration.spec.ts`

**Purpose**: Test API endpoints with real database interactions.

**Key Features**:
- Real HTTP requests
- Database operations
- Authentication flows
- Response validation

**Examples**:
```typescript
describe('AuthController (Integration)', () => {
  it('should complete registration flow', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send(userData)
      .expect(201);
  });
});
```

**Run Commands**:
```bash
bun run test:integration             # All integration tests
bun run test:integration --verbose   # Detailed output
```

### 3. End-to-End Tests

**Location**: `test/e2e/*.e2e.spec.ts`

**Purpose**: Test complete user workflows from registration to harvest.

**Key Features**:
- Full application testing
- Real user scenarios
- Multi-step workflows
- Cross-module integration

**Test Scenarios**:
- Complete farmer journey (registration → profile → farm → cultivation → harvest)
- Agent supporting farmers
- Admin management workflows
- Error handling scenarios

**Run Commands**:
```bash
bun run test:e2e                    # All E2E tests
bun run test:e2e --testTimeout=60000 # Extended timeout
```

### 4. Performance Tests

**Location**: `test/performance/`

**Purpose**: Validate system performance under load.

**Key Features**:
- Load testing with Artillery
- Simulates 200,000+ farmers
- Realistic user scenarios
- Performance metrics collection

**Test Phases**:
1. **Warm-up** (60s, 10 users/sec)
2. **Peak Load** (120s, 50-200 users/sec)
3. **Sustained Load** (300s, 100 users/sec)
4. **Stress Test** (180s, 300-500 users/sec)

**Run Commands**:
```bash
bun run test:performance            # Full load test
artillery run test/performance/load-test.yml --output report.json
```

### 5. Database Tests

**Location**: `test/database/*.spec.ts`

**Purpose**: Test repository patterns and database constraints.

**Features**:
- Repository testing
- Entity relationships
- Data integrity
- Query optimization

## Test Configuration

### Jest Configuration

Our Jest setup includes:

```javascript
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "testTimeout": 30000,
  "maxWorkers": "50%"
}
```

### Coverage Exclusions

We exclude from coverage:
- DTOs and interfaces
- Entity definitions
- Configuration files
- Migration files
- Test files

### Environment Variables

Test-specific environment variables:

```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret-for-testing-only
TEST_DATABASE_URL=sqlite://:memory:
SMS_ENABLED=false
REDIS_URL=redis://localhost:6379/15
```

## Test Data Management

### Test Utilities

**TestHelper Class** (`test/setup.ts`):
- Mock repository creation
- Authentication helpers
- Test data generation

```typescript
const mockRepo = TestHelper.createMockRepository<User>();
const { token, userId } = await TestHelper.authenticateUser(userData);
```

### Fake Data Generation

Using `@faker-js/faker` for realistic test data:

```typescript
const testUser = {
  phoneNumber: faker.phone.number('+91#########'),
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
};
```

### Database Seeding

For integration tests, we use:
- In-memory SQLite for fast tests
- PostgreSQL for full integration
- Automated cleanup between tests

## Performance Testing

### Load Test Configuration

Our Artillery configuration simulates real-world usage:

```yaml
phases:
  - duration: 60
    arrivalRate: 10      # Warm-up
  - duration: 120
    arrivalRate: 50
    rampTo: 200         # Peak load
  - duration: 300
    arrivalRate: 100    # Sustained load
```

### Scenarios Tested

1. **Authentication Flow** (40% of traffic)
2. **Profile Management** (25% of traffic)
3. **Farm Management** (20% of traffic)
4. **Crop Management** (15% of traffic)

### Performance Targets

- 99th percentile < 2000ms
- 95th percentile < 1500ms
- Error rate < 5%
- Support for 200,000+ concurrent farmers

## Continuous Integration

### Test Pipeline

```bash
# CI/CD Pipeline Steps
1. Install dependencies
2. Lint checking
3. Type checking
4. Unit tests with coverage
5. Integration tests
6. E2E tests
7. Performance tests
8. Generate reports
```

### Quality Gates

Tests must pass these gates:
- ✅ 80% code coverage minimum
- ✅ All linting rules pass
- ✅ No TypeScript errors
- ✅ All tests pass
- ✅ Performance under thresholds

## Test Reports

### Generated Reports

After running tests, you'll find:

```
test-reports/
├── test-summary.json          # Overall test summary
├── test-detailed.json         # Detailed test results
├── test-metrics.json          # Performance metrics
├── test-failures.json         # Failed test details
├── slow-tests.json           # Performance bottlenecks
├── artillery-report.html     # Load test results
└── junit.xml                 # CI/CD compatible format
```

### Coverage Reports

```
coverage/
├── consolidated/
│   └── index.html           # Visual coverage report
├── lcov.info               # LCOV format
└── coverage-final.json     # JSON format
```

## Debugging Tests

### Debug Mode

```bash
bun run test:debug              # Debug all tests
bun run test:debug auth.service # Debug specific test
```

### Common Issues

**1. Test Timeouts**
```bash
# Increase timeout for specific tests
jest.setTimeout(60000);
```

**2. Database Connection Issues**
```bash
# Check test database setup
bun run db:test:setup
```

**3. Mock Issues**
```typescript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert Pattern**
```typescript
it('should do something', () => {
  // Arrange
  const input = createTestData();
  
  // Act
  const result = serviceMethod(input);
  
  // Assert
  expect(result).toEqual(expected);
});
```

2. **Descriptive Test Names**
```typescript
// Good
it('should return 401 when user provides invalid credentials')

// Bad
it('should fail login')
```

3. **Test Data Isolation**
```typescript
beforeEach(async () => {
  // Clean database
  await cleanup();
  // Create fresh test data
  testData = await createTestData();
});
```

### Performance Testing

1. **Realistic Scenarios**
   - Use real Indian phone numbers
   - Test with Karnataka locations
   - Include seasonal crop data

2. **Gradual Load Increase**
   - Start with warm-up phase
   - Gradually increase load
   - Test beyond normal capacity

3. **Monitor Resources**
   - CPU usage
   - Memory consumption
   - Database connections
   - Response times

## Troubleshooting

### Common Solutions

**Tests Failing Randomly**
- Check for race conditions
- Ensure proper cleanup
- Use deterministic test data

**Performance Tests Failing**
- Check system resources
- Verify network conditions
- Review timeout configurations

**Coverage Not Meeting Threshold**
- Review excluded files
- Add missing test cases
- Check branch coverage

**Integration Tests Failing**
- Verify database state
- Check test isolation
- Review mock configurations

## Contributing

### Adding New Tests

1. **For New Features**:
   ```bash
   # Create unit test alongside feature
   src/new-feature/new-feature.service.ts
   src/new-feature/new-feature.service.spec.ts
   ```

2. **For API Endpoints**:
   ```bash
   # Add integration test
   test/new-feature.controller.integration.spec.ts
   ```

3. **For User Workflows**:
   ```bash
   # Add E2E test
   test/e2e/new-workflow.e2e.spec.ts
   ```

### Test Maintenance

- Update test data regularly
- Review slow tests monthly
- Update performance baselines
- Clean up obsolete tests

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/)
- [Artillery Load Testing](https://artillery.io/docs/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

### Tools
- **Jest**: Unit and integration testing
- **Supertest**: HTTP assertion testing
- **Artillery**: Load and performance testing
- **Faker**: Test data generation
- **TestContainers**: Integration with real databases

---

**For Support**: Contact the development team or create an issue in the repository.

**Last Updated**: $(date)
**Version**: 1.0.0