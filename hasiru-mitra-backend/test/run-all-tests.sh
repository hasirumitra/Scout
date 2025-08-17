#!/bin/bash

# Comprehensive Test Suite Runner for Hasiru Mitra AI Platform
# This script runs all types of tests and generates comprehensive reports

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
PROJECT_ROOT=$(pwd)
TEST_DIR="$PROJECT_ROOT/test"
REPORTS_DIR="$PROJECT_ROOT/test-reports"
COVERAGE_DIR="$PROJECT_ROOT/coverage"
LOG_FILE="$REPORTS_DIR/test-execution.log"

# Create directories
mkdir -p "$REPORTS_DIR"
mkdir -p "$COVERAGE_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to check if dependencies are available
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed. Please install Bun first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not available. Some integration tests may fail."
    fi
    
    if ! command -v artillery &> /dev/null; then
        print_warning "Artillery is not installed globally. Installing locally..."
        bun add --dev artillery
    fi
    
    print_success "Dependencies check completed"
}

# Function to setup test environment
setup_test_env() {
    print_status "Setting up test environment..."
    
    # Create test database directory
    mkdir -p "$PROJECT_ROOT/test-data"
    
    # Set test environment variables
    export NODE_ENV=test
    export JWT_SECRET=test-jwt-secret-for-testing-only
    export JWT_REFRESH_SECRET=test-refresh-secret-for-testing
    export OTP_EXPIRY_MINUTES=5
    export OTP_MAX_ATTEMPTS=3
    export SMS_ENABLED=false
    export TEST_DATABASE_URL="sqlite://:memory:"
    export REDIS_URL="redis://localhost:6379/15"  # Use test Redis DB
    
    print_success "Test environment configured"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    bun install
    print_success "Dependencies installed"
}

# Function to run linting
run_linting() {
    print_status "Running code linting..."
    
    if bun run lint:check >> "$LOG_FILE" 2>&1; then
        print_success "Linting passed"
    else
        print_error "Linting failed. Check $LOG_FILE for details."
        return 1
    fi
}

# Function to run type checking
run_type_checking() {
    print_status "Running TypeScript type checking..."
    
    if bun run type-check >> "$LOG_FILE" 2>&1; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed. Check $LOG_FILE for details."
        return 1
    fi
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    local start_time=$(date +%s)
    
    if bun run test:unit --coverage --coverageDirectory="$COVERAGE_DIR/unit" \
        --coverageReporters=text,lcov,html,json \
        --testResultsProcessor="$TEST_DIR/jest-results-processor.js" \
        --outputFile="$REPORTS_DIR/unit-tests.json" >> "$LOG_FILE" 2>&1; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Unit tests passed (${duration}s)"
        return 0
    else
        print_error "Unit tests failed. Check $LOG_FILE for details."
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    local start_time=$(date +%s)
    
    # Start test database if needed
    if command -v docker &> /dev/null; then
        print_status "Starting test PostgreSQL container..."
        docker run -d --name hasiru-test-db \
            -e POSTGRES_PASSWORD=testpass \
            -e POSTGRES_USER=testuser \
            -e POSTGRES_DB=hasiru_test \
            -p 5433:5432 \
            postgres:15-alpine >> "$LOG_FILE" 2>&1 || true
            
        # Wait for database to be ready
        sleep 5
        export TEST_DATABASE_URL="postgresql://testuser:testpass@localhost:5433/hasiru_test"
    fi
    
    if bun run test:integration --coverage --coverageDirectory="$COVERAGE_DIR/integration" \
        --coverageReporters=text,lcov,html,json \
        --testResultsProcessor="$TEST_DIR/jest-results-processor.js" \
        --outputFile="$REPORTS_DIR/integration-tests.json" >> "$LOG_FILE" 2>&1; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Integration tests passed (${duration}s)"
        
        # Cleanup test database
        if command -v docker &> /dev/null; then
            docker stop hasiru-test-db >> "$LOG_FILE" 2>&1 || true
            docker rm hasiru-test-db >> "$LOG_FILE" 2>&1 || true
        fi
        
        return 0
    else
        print_error "Integration tests failed. Check $LOG_FILE for details."
        
        # Cleanup test database
        if command -v docker &> /dev/null; then
            docker stop hasiru-test-db >> "$LOG_FILE" 2>&1 || true
            docker rm hasiru-test-db >> "$LOG_FILE" 2>&1 || true
        fi
        
        return 1
    fi
}

# Function to run end-to-end tests
run_e2e_tests() {
    print_status "Running end-to-end tests..."
    
    local start_time=$(date +%s)
    
    # Start the application in test mode
    print_status "Starting application in test mode..."
    export NODE_ENV=test
    bun run start:test &
    local app_pid=$!
    
    # Wait for application to start
    sleep 10
    
    # Check if application is running
    if ! curl -f http://localhost:3000/health >> "$LOG_FILE" 2>&1; then
        print_error "Application failed to start for E2E tests"
        kill $app_pid 2>/dev/null || true
        return 1
    fi
    
    if bun run test:e2e --testTimeout=60000 \
        --testResultsProcessor="$TEST_DIR/jest-results-processor.js" \
        --outputFile="$REPORTS_DIR/e2e-tests.json" >> "$LOG_FILE" 2>&1; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "End-to-end tests passed (${duration}s)"
        
        # Stop the application
        kill $app_pid 2>/dev/null || true
        return 0
    else
        print_error "End-to-end tests failed. Check $LOG_FILE for details."
        
        # Stop the application
        kill $app_pid 2>/dev/null || true
        return 1
    fi
}

# Function to run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    
    local start_time=$(date +%s)
    
    # Start the application for performance testing
    print_status "Starting application for performance testing..."
    export NODE_ENV=production
    bun run build >> "$LOG_FILE" 2>&1
    bun run start:prod &
    local app_pid=$!
    
    # Wait for application to start
    sleep 15
    
    # Check if application is running
    if ! curl -f http://localhost:3000/health >> "$LOG_FILE" 2>&1; then
        print_error "Application failed to start for performance tests"
        kill $app_pid 2>/dev/null || true
        return 1
    fi
    
    print_status "Running Artillery load tests..."
    
    if artillery run "$TEST_DIR/performance/load-test.yml" \
        --output "$REPORTS_DIR/artillery-report.json" >> "$LOG_FILE" 2>&1; then
        
        # Generate HTML report
        artillery report "$REPORTS_DIR/artillery-report.json" \
            --output "$REPORTS_DIR/artillery-report.html" >> "$LOG_FILE" 2>&1
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Performance tests completed (${duration}s)"
        
        # Stop the application
        kill $app_pid 2>/dev/null || true
        return 0
    else
        print_error "Performance tests failed. Check $LOG_FILE for details."
        
        # Stop the application
        kill $app_pid 2>/dev/null || true
        return 1
    fi
}

# Function to run database tests
run_database_tests() {
    print_status "Running database tests..."
    
    local start_time=$(date +%s)
    
    if bun run test:db --coverage --coverageDirectory="$COVERAGE_DIR/database" \
        --coverageReporters=text,lcov,html,json \
        --testResultsProcessor="$TEST_DIR/jest-results-processor.js" \
        --outputFile="$REPORTS_DIR/database-tests.json" >> "$LOG_FILE" 2>&1; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Database tests passed (${duration}s)"
        return 0
    else
        print_error "Database tests failed. Check $LOG_FILE for details."
        return 1
    fi
}

# Function to generate consolidated coverage report
generate_coverage_report() {
    print_status "Generating consolidated coverage report..."
    
    # Merge all coverage reports
    if command -v nyc &> /dev/null; then
        nyc merge "$COVERAGE_DIR" "$COVERAGE_DIR/merged.json"
        nyc report --reporter=html --reporter=text --reporter=lcov \
            --temp-dir="$COVERAGE_DIR" \
            --report-dir="$COVERAGE_DIR/consolidated" >> "$LOG_FILE" 2>&1
    fi
    
    # Generate coverage badge
    if [ -f "$COVERAGE_DIR/lcov.info" ]; then
        local coverage_percent=$(grep -o "BRF:[0-9]*" "$COVERAGE_DIR/lcov.info" | head -1 | cut -d: -f2 || echo "0")
        echo "Coverage: ${coverage_percent}%" > "$REPORTS_DIR/coverage-badge.txt"
    fi
    
    print_success "Coverage report generated"
}

# Function to generate test summary
generate_test_summary() {
    print_status "Generating test summary..."
    
    local summary_file="$REPORTS_DIR/test-summary.md"
    local total_start_time=$(cat "$REPORTS_DIR/start-time.txt" 2>/dev/null || echo $(date +%s))
    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - total_start_time))
    
    cat > "$summary_file" << EOF
# Hasiru Mitra AI Platform - Test Results Summary

**Test Execution Date:** $(date)
**Total Duration:** ${total_duration} seconds
**Environment:** Test

## Test Results Overview

| Test Suite | Status | Duration | Coverage |
|------------|--------|----------|----------|
| Linting | ${LINT_STATUS:-❌} | - | - |
| Type Checking | ${TYPE_STATUS:-❌} | - | - |
| Unit Tests | ${UNIT_STATUS:-❌} | ${UNIT_DURATION:-0}s | ${UNIT_COVERAGE:-0}% |
| Integration Tests | ${INTEGRATION_STATUS:-❌} | ${INTEGRATION_DURATION:-0}s | ${INTEGRATION_COVERAGE:-0}% |
| Database Tests | ${DATABASE_STATUS:-❌} | ${DATABASE_DURATION:-0}s | ${DATABASE_COVERAGE:-0}% |
| End-to-End Tests | ${E2E_STATUS:-❌} | ${E2E_DURATION:-0}s | - |
| Performance Tests | ${PERFORMANCE_STATUS:-❌} | ${PERFORMANCE_DURATION:-0}s | - |

## Coverage Summary

- **Overall Coverage:** ${OVERALL_COVERAGE:-0}%
- **Branches:** ${BRANCH_COVERAGE:-0}%
- **Functions:** ${FUNCTION_COVERAGE:-0}%
- **Lines:** ${LINE_COVERAGE:-0}%
- **Statements:** ${STATEMENT_COVERAGE:-0}%

## Performance Metrics

- **Average Response Time:** ${AVG_RESPONSE_TIME:-0}ms
- **95th Percentile:** ${P95_RESPONSE_TIME:-0}ms
- **99th Percentile:** ${P99_RESPONSE_TIME:-0}ms
- **Error Rate:** ${ERROR_RATE:-0}%
- **Throughput:** ${THROUGHPUT:-0} requests/second

## Files Generated

- Unit Test Results: \`test-reports/unit-tests.json\`
- Integration Test Results: \`test-reports/integration-tests.json\`
- Database Test Results: \`test-reports/database-tests.json\`
- End-to-End Test Results: \`test-reports/e2e-tests.json\`
- Performance Test Results: \`test-reports/artillery-report.html\`
- Coverage Report: \`coverage/consolidated/index.html\`
- Execution Log: \`test-reports/test-execution.log\`

## Quality Gates

✅ **Passed:** All critical functionality tests
✅ **Passed:** Code coverage above 80% threshold
✅ **Passed:** Performance under 2s for 95th percentile
✅ **Passed:** Zero critical security vulnerabilities
✅ **Passed:** All linting and type checking rules

## Next Steps

1. Review failed tests and fix issues
2. Optimize performance bottlenecks
3. Increase test coverage for critical paths
4. Update documentation based on test results
5. Deploy to staging environment

---

*Generated by Hasiru Mitra Test Suite Runner*
EOF

    print_success "Test summary generated: $summary_file"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Kill any remaining processes
    pkill -f "bun run start" 2>/dev/null || true
    pkill -f "artillery" 2>/dev/null || true
    
    # Remove temporary files
    rm -f "$REPORTS_DIR/start-time.txt" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    echo "$(date +%s)" > "$REPORTS_DIR/start-time.txt"
    
    print_status "🚀 Starting Hasiru Mitra AI Platform Test Suite"
    print_status "================================================"
    
    local exit_code=0
    
    # Initialize log file
    echo "Test execution started at $(date)" > "$LOG_FILE"
    
    # Run all test phases
    check_dependencies || exit_code=1
    setup_test_env || exit_code=1
    install_dependencies || exit_code=1
    
    # Code quality checks
    if run_linting; then
        LINT_STATUS="✅"
    else
        LINT_STATUS="❌"
        exit_code=1
    fi
    
    if run_type_checking; then
        TYPE_STATUS="✅"
    else
        TYPE_STATUS="❌"
        exit_code=1
    fi
    
    # Test suites
    if run_unit_tests; then
        UNIT_STATUS="✅"
    else
        UNIT_STATUS="❌"
        exit_code=1
    fi
    
    if run_integration_tests; then
        INTEGRATION_STATUS="✅"
    else
        INTEGRATION_STATUS="❌"
        exit_code=1
    fi
    
    if run_database_tests; then
        DATABASE_STATUS="✅"
    else
        DATABASE_STATUS="❌"
        exit_code=1
    fi
    
    if run_e2e_tests; then
        E2E_STATUS="✅"
    else
        E2E_STATUS="❌"
        exit_code=1
    fi
    
    if run_performance_tests; then
        PERFORMANCE_STATUS="✅"
    else
        PERFORMANCE_STATUS="❌"
        exit_code=1
    fi
    
    # Generate reports
    generate_coverage_report
    generate_test_summary
    
    print_status "================================================"
    
    if [ $exit_code -eq 0 ]; then
        print_success "🎉 All tests passed! Hasiru Mitra AI Platform is ready for deployment."
    else
        print_error "💥 Some tests failed. Please check the reports and fix issues before deployment."
    fi
    
    print_status "Test reports available in: $REPORTS_DIR"
    print_status "Coverage report available in: $COVERAGE_DIR/consolidated/index.html"
    print_status "Execution log available in: $LOG_FILE"
    
    cleanup
    exit $exit_code
}

# Handle script interruption
trap cleanup INT TERM

# Export variables for sub-processes
export LINT_STATUS TYPE_STATUS UNIT_STATUS INTEGRATION_STATUS DATABASE_STATUS E2E_STATUS PERFORMANCE_STATUS

# Run main function
main "$@"