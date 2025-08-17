const fs = require('fs');
const path = require('path');

/**
 * Custom Jest Results Processor for Hasiru Mitra AI Platform
 * Generates detailed test reports and metrics for quality assurance
 */

class TestResultsProcessor {
  constructor(results, options = {}) {
    this.results = results;
    this.options = options;
    this.reportsDir = path.resolve(process.cwd(), 'test-reports');
    this.timestamp = new Date().toISOString();
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  process() {
    try {
      this.generateSummaryReport();
      this.generateDetailedReport();
      this.generateMetricsReport();
      this.generateFailureReport();
      this.generateSlowTestsReport();
      this.updateOverallMetrics();
      
      console.log(`📊 Test results processed successfully`);
      console.log(`📁 Reports saved to: ${this.reportsDir}`);
      
      return this.results;
    } catch (error) {
      console.error('❌ Error processing test results:', error);
      return this.results;
    }
  }

  generateSummaryReport() {
    const summary = {
      timestamp: this.timestamp,
      testSuites: {
        total: this.results.numTotalTestSuites,
        passed: this.results.numPassedTestSuites,
        failed: this.results.numFailedTestSuites,
        pending: this.results.numPendingTestSuites,
        todo: this.results.numTodoTests,
      },
      tests: {
        total: this.results.numTotalTests,
        passed: this.results.numPassedTests,
        failed: this.results.numFailedTests,
        pending: this.results.numPendingTests,
        skipped: this.results.numSkippedTests,
      },
      coverage: this.results.coverageMap ? {
        statements: this.getCoveragePercentage('statements'),
        branches: this.getCoveragePercentage('branches'),
        functions: this.getCoveragePercentage('functions'),
        lines: this.getCoveragePercentage('lines'),
      } : null,
      performance: {
        startTime: this.results.startTime,
        endTime: new Date().getTime(),
        duration: new Date().getTime() - this.results.startTime,
        averageTestDuration: this.getAverageTestDuration(),
      },
      success: this.results.success,
      wasInterrupted: this.results.wasInterrupted,
    };

    const summaryPath = path.join(this.reportsDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`✅ Summary report: ${summary.tests.passed}/${summary.tests.total} tests passed`);
  }

  generateDetailedReport() {
    const detailed = {
      timestamp: this.timestamp,
      testResults: this.results.testResults.map(testResult => ({
        testFilePath: testResult.testFilePath,
        numFailingTests: testResult.numFailingTests,
        numPassingTests: testResult.numPassingTests,
        numPendingTests: testResult.numPendingTests,
        numTodoTests: testResult.numTodoTests,
        duration: testResult.perfStats.runtime,
        status: testResult.numFailingTests > 0 ? 'failed' : 'passed',
        assertionResults: testResult.testResults.map(test => ({
          title: test.title,
          fullName: test.fullName,
          status: test.status,
          duration: test.duration,
          failureMessages: test.failureMessages,
          ancestorTitles: test.ancestorTitles,
        })),
        failureMessage: testResult.failureMessage,
        console: testResult.console,
      })),
    };

    const detailedPath = path.join(this.reportsDir, 'test-detailed.json');
    fs.writeFileSync(detailedPath, JSON.stringify(detailed, null, 2));
  }

  generateMetricsReport() {
    const testFiles = this.results.testResults;
    const slowThreshold = 5000; // 5 seconds
    const verySlowThreshold = 10000; // 10 seconds

    const metrics = {
      timestamp: this.timestamp,
      fileMetrics: testFiles.map(file => {
        const duration = file.perfStats.runtime;
        const testCount = file.numPassingTests + file.numFailingTests;
        
        return {
          file: path.relative(process.cwd(), file.testFilePath),
          duration: duration,
          testCount: testCount,
          averageTestDuration: testCount > 0 ? duration / testCount : 0,
          status: file.numFailingTests > 0 ? 'failed' : 'passed',
          performance: duration > verySlowThreshold ? 'very_slow' : 
                      duration > slowThreshold ? 'slow' : 'fast',
        };
      }),
      performance: {
        slowTests: testFiles.filter(f => f.perfStats.runtime > slowThreshold).length,
        verySlowTests: testFiles.filter(f => f.perfStats.runtime > verySlowThreshold).length,
        totalDuration: testFiles.reduce((sum, f) => sum + f.perfStats.runtime, 0),
        averageFileDuration: testFiles.length > 0 ? 
          testFiles.reduce((sum, f) => sum + f.perfStats.runtime, 0) / testFiles.length : 0,
      },
      qualityMetrics: {
        testDensity: this.calculateTestDensity(),
        coverageQuality: this.assessCoverageQuality(),
        flakyTestIndicators: this.detectFlakyTests(),
      }
    };

    const metricsPath = path.join(this.reportsDir, 'test-metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

    // Log performance warnings
    if (metrics.performance.verySlowTests > 0) {
      console.log(`⚠️  ${metrics.performance.verySlowTests} very slow test files detected`);
    }
  }

  generateFailureReport() {
    const failures = this.results.testResults
      .filter(testResult => testResult.numFailingTests > 0)
      .map(testResult => ({
        file: path.relative(process.cwd(), testResult.testFilePath),
        failureMessage: testResult.failureMessage,
        failingTests: testResult.testResults
          .filter(test => test.status === 'failed')
          .map(test => ({
            title: test.title,
            fullName: test.fullName,
            failureMessages: test.failureMessages,
            ancestorTitles: test.ancestorTitles,
          })),
      }));

    if (failures.length > 0) {
      const failuresPath = path.join(this.reportsDir, 'test-failures.json');
      fs.writeFileSync(failuresPath, JSON.stringify({
        timestamp: this.timestamp,
        totalFailures: failures.length,
        failures: failures,
      }, null, 2));

      console.log(`❌ ${failures.length} test files with failures`);
    }
  }

  generateSlowTestsReport() {
    const slowThreshold = 1000; // 1 second
    const allTests = [];

    this.results.testResults.forEach(testResult => {
      testResult.testResults.forEach(test => {
        if (test.duration && test.duration > slowThreshold) {
          allTests.push({
            file: path.relative(process.cwd(), testResult.testFilePath),
            testName: test.fullName,
            duration: test.duration,
            status: test.status,
          });
        }
      });
    });

    if (allTests.length > 0) {
      // Sort by duration (slowest first)
      allTests.sort((a, b) => b.duration - a.duration);

      const slowTestsPath = path.join(this.reportsDir, 'slow-tests.json');
      fs.writeFileSync(slowTestsPath, JSON.stringify({
        timestamp: this.timestamp,
        threshold: slowThreshold,
        slowTests: allTests,
      }, null, 2));

      console.log(`🐌 ${allTests.length} slow tests detected (>${slowThreshold}ms)`);
    }
  }

  updateOverallMetrics() {
    const metricsFile = path.join(this.reportsDir, 'overall-metrics.json');
    let overallMetrics = {};

    // Load existing metrics if they exist
    if (fs.existsSync(metricsFile)) {
      try {
        overallMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      } catch (error) {
        console.warn('Could not load existing metrics, creating new ones');
      }
    }

    // Initialize if needed
    if (!overallMetrics.testRuns) {
      overallMetrics.testRuns = [];
    }
    if (!overallMetrics.trends) {
      overallMetrics.trends = {
        passRate: [],
        coverage: [],
        duration: [],
      };
    }

    // Add current run data
    const currentRun = {
      timestamp: this.timestamp,
      success: this.results.success,
      testsTotal: this.results.numTotalTests,
      testsPassed: this.results.numPassedTests,
      testsFailed: this.results.numFailedTests,
      passRate: this.results.numTotalTests > 0 ? 
        (this.results.numPassedTests / this.results.numTotalTests * 100).toFixed(2) : 0,
      duration: new Date().getTime() - this.results.startTime,
      coverage: this.getCoveragePercentage('lines'),
    };

    overallMetrics.testRuns.unshift(currentRun);
    
    // Keep only last 50 runs
    if (overallMetrics.testRuns.length > 50) {
      overallMetrics.testRuns = overallMetrics.testRuns.slice(0, 50);
    }

    // Update trends
    overallMetrics.trends.passRate.unshift(parseFloat(currentRun.passRate));
    overallMetrics.trends.coverage.unshift(currentRun.coverage || 0);
    overallMetrics.trends.duration.unshift(currentRun.duration);

    // Keep only last 20 trend points
    Object.keys(overallMetrics.trends).forEach(key => {
      if (overallMetrics.trends[key].length > 20) {
        overallMetrics.trends[key] = overallMetrics.trends[key].slice(0, 20);
      }
    });

    // Calculate quality indicators
    overallMetrics.qualityIndicators = {
      averagePassRate: this.calculateAverage(overallMetrics.trends.passRate),
      averageCoverage: this.calculateAverage(overallMetrics.trends.coverage),
      averageDuration: this.calculateAverage(overallMetrics.trends.duration),
      stability: this.calculateStability(overallMetrics.testRuns.slice(0, 10)),
      lastUpdated: this.timestamp,
    };

    fs.writeFileSync(metricsFile, JSON.stringify(overallMetrics, null, 2));
  }

  // Helper methods
  getCoveragePercentage(type) {
    if (!this.results.coverageMap) return null;
    
    try {
      // This is a simplified version - actual implementation would depend on Istanbul/nyc
      // coverage format
      return 0; // Placeholder
    } catch (error) {
      return null;
    }
  }

  getAverageTestDuration() {
    const allTests = [];
    this.results.testResults.forEach(testResult => {
      testResult.testResults.forEach(test => {
        if (test.duration) {
          allTests.push(test.duration);
        }
      });
    });

    if (allTests.length === 0) return 0;
    return allTests.reduce((sum, duration) => sum + duration, 0) / allTests.length;
  }

  calculateTestDensity() {
    // Calculate tests per source file ratio
    const totalTests = this.results.numTotalTests;
    const testFiles = this.results.testResults.length;
    
    return testFiles > 0 ? (totalTests / testFiles).toFixed(2) : 0;
  }

  assessCoverageQuality() {
    // Placeholder for coverage quality assessment
    return {
      score: 'N/A',
      recommendations: [],
    };
  }

  detectFlakyTests() {
    // Placeholder for flaky test detection
    // In a real implementation, this would analyze test history
    return {
      detected: 0,
      suspects: [],
    };
  }

  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  calculateStability(recentRuns) {
    if (recentRuns.length < 2) return 100;
    
    const successfulRuns = recentRuns.filter(run => run.success).length;
    return (successfulRuns / recentRuns.length * 100).toFixed(2);
  }
}

module.exports = (results, options) => {
  const processor = new TestResultsProcessor(results, options);
  return processor.process();
};

// Export class for testing
module.exports.TestResultsProcessor = TestResultsProcessor;